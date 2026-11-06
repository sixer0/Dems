---
task_id: 2026-10-12_input_av_core_adapter_plan
date: 2026-10-12
agent: explore
row: 2
scope: Core capture target as built - adapter layer, capture session, three modules, capture-protocol plan, shared capture constants, capture worker (ingest, mux, audio)
tier: 2 (finding, why it matters, how verified, file:line)
---

# Core Capture Target As Built (Row 2)

## Overview

Facts only. No verdict, no design proposal. Every path is relative to `/Users/gsp-budi/Documents/DEMS/` and every statement carries `file:line`. Reading was read-only; nothing under `apps/input-av/data/` was opened, no `.env` was read, nothing was built, run or started.

Seam labels (from `identification/02_structured.md:118-129`): S1 ONVIF_RTSP camera adapter (opener plus stream-URI resolution); S2 camera discovery with fallbacks; S3 USB_AUDIO adapter (enumerate, open, level); S4 mic transport; S5 capture plan; S6 capture worker.

Provenance: Graft skeletons were used for `capture/adapters/local/mic-helper.ts`, `capture/adapters/local/mic-pipe.ts` and `capture-session/index.ts` (symbol and span lists only); everything else was read directly with `Read`/`sed`/`grep`. Graft was not used for config files or for the worker C sources.

## Section index (the 13 named items) and seam tags

| # | Item | Seam |
|---|---|---|
| 1 | Adapter contract members | S1, S2, S3, S4, S5 |
| 2 | Kinds | S1, S3 |
| 3 | Opener rule `OPENER_CAPABLE_KINDS`, every match and every pin | S1, S3 |
| 4 | What the production stubs refuse (and the loader) | S1, S2, S3 |
| 5 | WS-Discovery with ONVIF discovery | S2 |
| 6 | ONVIF connection test, H.264-only outcome, stream-URI handling | S1 |
| 7 | `local/` adapter as a built opener | S1, S3, S4 |
| 8 | Credential sealing | S1 |
| 9 | Mic transport | S4 |
| 10 | Capture plan shape | S5 |
| 11 | Worker ingest and fMP4 mux, codec handling (HEVC statement here) | S6 |
| 12 | Worker audio path | S6, S4 |
| 13 | One-open-session rule | S5, S6 |
| + | Supporting units: capture-session, the three modules, the fence | S1-S5 |

---

## 1. Adapter contract members (`apps/core-server/src/capture/adapters/types.ts`) - S1 S2 S3 S4 S5

- Three seams, one union: `CaptureAdapter = CameraAdapter | AudioInputAdapter | PoeController` (`types.ts:217`).
- `CameraAdapter` members (`types.ts:125-146`): `seam: 'CAMERA'`, `kind`, `devices`, `hasOpener` (131), `discover(search)` (133), `testConnection(candidate, credential|null, signal)` (138), `openSource(deviceId, target, signal)` (140), `profiles(deviceId)` (141), `pullUrl(deviceId, profile)` (143), `ntpOffsetMs(deviceId)` (145).
- `openSource` target is `CameraSourceTarget { ingestUrl }`, "the worker's loopback listener of the plan" (`types.ts:120-123`). The source pushes to the worker; the worker listens.
- `MediaProfile { code; codec: 'H264' | 'HEVC' | 'OTHER' }` (`types.ts:108-112`); a static test pins that exact text and forbids the word H265 in adapter-layer sources (`adapters/__tests__/static.test.ts:266-274`).
- `SourceHandle { deviceId; close() }`, closing twice is safe (`types.ts:115-118`).
- `AudioInputAdapter` members (`types.ts:204-215`): `seam: 'AUDIO'`, `kind`, `devices`, `hasOpener`, `enumerate(): AudioInputDescriptor[]` (210), `open(inputId, { sessionId, signal }): AudioStreamHandle` (212), `level(inputId): number | null` (214, "dBFS at most 0, or null").
- `AudioStreamHandle extends SourceHandle { input: CapturePlanMic['input']; transport: MicTransportStatement }` (`types.ts:198-202`); `input` goes into the plan unchanged (`types.ts:194-197`).
- `AudioInputDescriptor { inputId, present, errorCode }`; named error codes PERMISSION_DENIED, DEVICE_BUSY, DEVICE_NOT_FOUND, OPEN_FAILED, HELPER_EXITED (`types.ts:171-186`).
- `CameraCandidate` (`types.ts:65-78`): `adapterKind`, `host` (IP literal), `serviceAddress|null`, `endpointRef`, `vendor`, `model`, `name`, `testable`, `conflict`. `DiscoverySearch { windowMs, signal }` carries no address, port or filter (`types.ts:53-58`).
- `ConnectionTestOutcome` has five values: REACHABLE, AUTHENTICATION_FAILED, WRONG_PROFILE, NOT_H264, UNREACHABLE (`types.ts:90-97`). `ConnectionTestResult { outcome, authenticated, usableProfiles }`, "the usable H.264 profile codes" (`types.ts:100-106`).
- `PoeController` members: `status(port)`, `cycle(port)` (`types.ts:153-166`).
- `CaptureDeviceRegistry` members: `operation`, `register`, `list`, `describe`, `resolve`, `cameraAdapters`, `openerKinds`, `assertRecordable`, `assertAssignable` (`types.ts:222-244`). `resolve` is "refused while a session is open (OD-10)" (`types.ts:230`).
- Header of the file states what the layer does not build: no socket, no process, no file; the real camera recording path and real microphone transport are "class C" (`types.ts:9-20`). Note: since that header was written, rows 131/142 added a real UDP search and an HTTP connection test (items 5, 6); the header text was not updated.

## 2. The kinds (`capture/adapters/kinds.ts`) - S1 S3

- Five adapter kinds: ONVIF_RTSP, USB_AUDIO, SNMP_POE, FAKE, LOCAL_DEVICE (`kinds.ts:26-32`).
- Source class derived by one function `sourceClassOf` (`kinds.ts:39-50`): ONVIF_RTSP, USB_AUDIO, SNMP_POE = PRODUCTION; FAKE, LOCAL_DEVICE = DEVELOPMENT.
- Three capture operations: SIMULATED, REAL_PRODUCTION, REAL_DEVELOPMENT (`kinds.ts:53-57`). Decided once at boot by the fence function (`capture/fence/operation.ts:15-16`, `:80`).
- `registrableKindsOf(operation)` (`kinds.ts:72-76`): REAL_PRODUCTION registers the three PRODUCTION kinds; REAL_DEVELOPMENT registers FAKE, LOCAL_DEVICE plus ONVIF_RTSP (for search and connection test only, "never assignable... no opener"); SIMULATED registers none.
- Which kinds may stand behind which seam: CAMERA = ONVIF_RTSP, FAKE, LOCAL_DEVICE; AUDIO = USB_AUDIO, FAKE, LOCAL_DEVICE; POE = SNMP_POE, FAKE (`registry.ts:23-27`).
- The same five names are the database value set `CAPTURE_ADAPTER_KIND` (`db/schema/value-sets.ts:143`), checked on `capture_devices` (`db/schema/capture.ts:80`) and on `session_capture_sources` (`db/schema/recording.ts:203`). The slot-to-kind pairing is a database check (`db/schema/recording.ts:205-208`) and is repeated in code (`capture/fence/sources.ts:66-71`).
- Pins on the kind list: `adapters/__tests__/registry.test.ts:42-43,49`; list-against-list test A-7 `adapters/__tests__/static.test.ts:277-290`; schema pin `test/db/set4-rules.test.ts` (named at `kinds.ts:14-16`, not opened).

## 3. The opener rule `OPENER_CAPABLE_KINDS` - S1 S3

Definition and meaning:
- `export const OPENER_CAPABLE_KINDS = Object.freeze([FAKE, LOCAL_DEVICE])` (`capture/adapters/registry.ts:36`). Comment: a production camera's recording path and a production microphone's transport are class C (C-2, C-4); an adapter of those kinds that claims an opener is refused at registration; "Adding a kind here is the decision that lands the class-C path" (`registry.ts:29-35`).
- `hasOpenerOf(adapter) = adapter.seam !== 'POE' && adapter.hasOpener` (`registry.ts:38`).

Every match of the identifier `OPENER_CAPABLE_KINDS` under `apps packages scripts docs` (grep, `node_modules` excluded):

| File:line | Role |
|---|---|
| `apps/core-server/src/capture/adapters/registry.ts:36` | the list (definition) |
| `apps/core-server/src/capture/adapters/registry.ts:82` | the refusal at registration: `hasOpenerOf(adapter) && !OPENER_CAPABLE_KINDS.includes(adapter.kind)` throws `CAPTURE_ADAPTER_INVALID` |
| `apps/core-server/src/capture/adapters/index.ts:71` | re-export from the barrel |
| `apps/core-server/src/capture/fence/sources.ts:30` | import |
| `apps/core-server/src/capture/fence/sources.ts:86` | `assertOperationRecordable`: an operation whose source class has no opener-capable kind is refused (`REAL_PRODUCTION` today) |
| `apps/core-server/src/capture/fence/sources.ts:106` | `buildSessionCaptureSources`: a non-simulated slot needs `descriptor.hasOpener === true` AND `OPENER_CAPABLE_KINDS.includes(adapterKind)`, else `SOURCE_KIND_NOT_RECORDABLE` |
| `apps/core-server/src/capture/adapters/__tests__/registry.test.ts:13` | import |
| `apps/core-server/src/capture/adapters/__tests__/registry.test.ts:89` | pin: `expect(OPENER_CAPABLE_KINDS).toEqual(['FAKE', 'LOCAL_DEVICE'])` |
| `apps/core-server/src/capture/adapters/__tests__/registry.test.ts:90` | pin: every listed kind is DEVELOPMENT class |
| `apps/core-server/src/capture/adapters/local/__tests__/camera-helper.test.ts:16` | import |
| `apps/core-server/src/capture/adapters/local/__tests__/camera-helper.test.ts:532` | `expect(OPENER_CAPABLE_KINDS).toContain(adapter.kind)` for the LOCAL_DEVICE camera |
| `docs/2026-10-07_dems_real_capture_sealing/implementation/25_m4_adapters.md:21,55` | documentation of the rule; line 55: "landing class C-2 / C-4 means adding the kind to `OPENER_CAPABLE_KINDS`" |

No match in `apps/web`, `apps/mobile`, `apps/capture-worker`, `packages/` or `scripts/`. The only other match under `docs/` is this task's own blueprint (`identification/02_structured.md:138`).

Other code that enforces the same fact without naming the constant (found by grep for `hasOpener`, `ADAPTER_INVALID`, `assertOperationRecordable`, `openerKinds`):
- Registry: `register` refusal `registry.ts:82`; `list` carries `hasOpener` (`registry.ts:62`); `openerKinds()` (`registry.ts:118-120`); `assertRecordable` throws `SOURCE_KIND_NOT_RECORDABLE` when `hasOpener` is false (`registry.ts:122-126`).
- Plan builder: `assertRecordableSelector` checks all four slots, maps the refusal to `NO_OPENER` / `NO_ADAPTER` / `MIXED_SOURCE_CLASSES` / `CLASS_NOT_OF_OPERATION` (`modules/capture-config/plan.ts:120-155`); `buildCapturePlan` calls it first (`plan.ts:199`).
- Session start: calls `assertRecordableSelector` (`capture-session/index.ts:622`), `buildCapturePlan` (`index.ts:1067`).
- Database: `session_capture_sources_pairing_check` (`db/schema/recording.ts:205-208`) - kinds only, not openers.
- Class-C stub files hard-code `hasOpener: false`: `camera/onvif-rtsp.ts:28`, `audio/usb-audio.ts:22`; the search-only adapter `camera/onvif-discovery.ts:41`.

Tests that pin the rule (behaviour, with or without the constant):
- `adapters/__tests__/registry.test.ts:88-111`: production camera claiming an opener is `CAPTURE_ADAPTER_INVALID` (92); production registry `openerKinds()` is `[]` (96); `assertRecordable` on production CAM/MIC is `SOURCE_KIND_NOT_RECORDABLE` (98-99); fake registry opener kinds `['FAKE']` (102); fake with `hasOpener:false` not recordable (107-110).
- `adapters/__tests__/fakes.test.ts:206`: `openerKinds()` is `['FAKE']`.
- `adapters/camera/__tests__/ws-discovery.test.ts:402-409`: the search adapter has `hasOpener:false`, registers in REAL_PRODUCTION and REAL_DEVELOPMENT, `openerKinds()` is `[]`, and SIMULATED refuses it (410).
- `adapters/__tests__/static.test.ts:95-101`: each class-C file matches `/hasOpener: false,|seam: 'POE'/` and imports only `../errors|kinds|types`.
- `adapters/__tests__/real.test.ts` (18 lines): loader refused outside REAL_PRODUCTION (`code: 'CAPTURE_REAL_ADAPTERS_REFUSED'`, line 15).
- `capture/fence/__tests__/fence.test.ts:386` (`openerKinds()` is `['FAKE','LOCAL_DEVICE']`) and `:508-529` (`assertRecordableSelector` / `buildSessionCaptureSources` refusals for production sets in both operations, development set in REAL_PRODUCTION, `hasOpener:false` slot).
- `modules/capture-config/__tests__/plan.test.ts:171-173,214` (REAL_PRODUCTION: nothing recordable; `CLASS_NOT_OF_OPERATION`).
- `capture-session/__tests__/session-capture.db.test.ts:436-445` (production-kind registry with `hasOpener:false`; `openerKinds()` is `[]`; opens never asked).

## 4. What the production stubs refuse (and the loader) - S1 S2 S3

- `loadProductionAdapters(operation, devices)` dynamically imports the three class-C files and refuses any operation other than REAL_PRODUCTION before the import (`adapters/real.ts:29-37`; the refusal precedes the first `import(` - pinned at `static.test.ts:91-92`).
- It has no caller outside its own test: grep for `loadProductionAdapters` over `apps/core-server/src` returns `real.ts:29`, `__tests__/real.test.ts:7,13`, `__tests__/static.test.ts:69,71,74` only. The REAL_PRODUCTION registry the boot builds holds no adapter (`capture/fence/index.ts:319-329`; "NO adapter... their loader is not called here").
- `ONVIF_RTSP` stub `createOnvifRtspCameraAdapter` (`camera/onvif-rtsp.ts:23-38`): `hasOpener:false` (28); `discover`, `testConnection`, `profiles`, `pullUrl`, `ntpOffsetMs` throw `CAPTURE_ADAPTER_CLASS_C` (29-30, 34-36; helper at 19-21); `openSource` throws `SOURCE_KIND_NOT_RECORDABLE` (31-33).
- `USB_AUDIO` stub `createUsbAudioInputAdapter` (`audio/usb-audio.ts:17-29`): `hasOpener:false` (22); `enumerate` and `level` throw `CAPTURE_ADAPTER_CLASS_C` (23, 27); `open` throws `SOURCE_KIND_NOT_RECORDABLE` (24-26).
- `SNMP_POE` stub `createSnmpPoeController` (`poe/snmp-poe.ts:12-17`): `status` and `cycle` throw `CAPTURE_ADAPTER_CLASS_C`.
- Refusal codes and their fixed texts: `errors.ts:9-56` (`CLASS_C_NOT_BUILT` at 35; `SOURCE_KIND_NOT_RECORDABLE` at 25; `ADAPTER_INVALID` at 19; `REAL_ADAPTERS_REFUSED` at 37).
- Static fences: no file but `real.ts` names a class-C file and nothing but its refusal test imports the loader (`static.test.ts:63-93`).
- Not a stub: the search half and the connection test of kind `ONVIF_RTSP` were built after the stubs (items 5, 6). `createOnvifDiscoveryAdapter` has `testConnection` still throwing `CLASS_C_NOT_BUILT` (`camera/onvif-discovery.ts:43-45`) because the real test is a separate facade (`camera/onvif-session.ts`), not a member of that adapter.

## 5. WS-Discovery with ONVIF discovery - S2

- `createOnvifDiscoveryAdapter(options)`: kind ONVIF_RTSP, serves no device (`devices: []`), `hasOpener:false`, `discover` delegates to the WS-Discovery search, every device member refuses (`camera/onvif-discovery.ts:32-53`).
- The probe (`camera/ws-discovery.ts`, header 1-34): picks eligible IPv4 interfaces; one `udp4` socket on port 0 (`createSocket` at 262); two typed probes (`tds:Device`, `dn:NetworkVideoTransmitter`, `ws-discovery.ts:60`) to the group `239.255.255.250:3702` (`ws-discovery.ts:54`) with TTL 1 (58, `setMulticastTTL` at 274), once per interface, repeated after 250 ms (56); closes at window end, datagram cap, abort, error.
- It "joins no group, listens for no announcement, opens no TCP connection, asks no device anything" (`ws-discovery.ts:18-20`). The search window is 3,000 ms (`packages/shared/src/api/capture.ts:140`).
- Caps: 256 datagrams, 64 responders, 4 interfaces, 2 KiB per candidate (`camera/discovery-collector.ts:28-34`); interface eligibility by property: IPv4, not internal, netmask not a host mask, non-zero hardware address (`discovery-collector.ts:59-79`). Answers read by fixed paths, 16 KiB cap, XML declarations refused (`camera/probe-answer.ts:9-24`, `:44-52`).
- "The search could not run" is a rejection, not an empty list: `NO_ELIGIBLE_INTERFACE`, `SOCKET_ERROR` (`ws-discovery.ts:64-83`).
- Test-only loopback fixture replaces the group by a unicast target on 127.0.0.1 (`ws-discovery.ts:30-33,109-110,137-141`).
- Fallbacks: grep for `fallback|fall back|unicast|subnet|arp` in `ws-discovery.ts`, `discovery-collector.ts`, `onvif-discovery.ts` and `modules/capture-discovery/search.ts` found only the loopback fixture (`ws-discovery.ts:30,109,137`). No second discovery path (no unicast scan, no operator-entered address) was found. Operation 93 "takes no body: there is nothing a caller could steer a search with (no address, subnet, interface, port, timeout or filter exists)" (`modules/capture-discovery/routes.ts:14-16`).
- Module `modules/capture-discovery/`: operations 93 `POST /api/v1/capture/discovery` and 94 `GET /api/v1/capture/discovery`, access CAPTURE_CONFIG, audit `CAPTURE_DISCOVERY_SEARCHED` (`routes.ts:5-7`); `search.ts` is "the ONE file of the server that calls `discover`" (`index.ts:7-8`); candidates live in memory only (`index.ts:9-10`); the adapter exists only when `captureMode: real` and a SIMULATED Core answers `503 DISCOVERY_NOT_READY` (`index.ts:19-24`); limits in `packages/shared/src/api/capture.ts:135-152` (min 10 s per session, 5 s per Core, 6 per minute, 30 per hour, list TTL 600 s, max 64 candidates).
- Connect flow (operations 95, 96, 89) is under `modules/capture-discovery/connect/` (`index.ts:33-36`); its test seam `ConnectionAttempt` is "the read-only test of `camera/onvif-session.ts`, or a camera adapter's `testConnection`" (`connect/service.ts:122-124`). Lock-out guard constants: 2 failures per host per 30 minutes (`packages/shared/src/api/capture.ts:175-178`).

## 6. ONVIF connection test, H.264-only outcome, stream-URI handling - S1

File `camera/onvif-session.ts` (501 lines). It is the one file that imports the `onvif` package (`onvif-session.ts:6`, import at 52).

- Reads: at most five, by device operation name: GetSystemDateAndTime, GetServices, GetCapabilities, GetProfiles, GetStreamUri (`onvif-session.ts:106`, steps at 449-493). No configuration call exists in the file (header 7-11). The credential travels as HTTP Digest (MD5 or SHA-256, `:144`) or a WS-Security `UsernameToken` with `PasswordDigest`; Basic is refused (`:19-27`, `:410-434`). Client built with `preserveAddress: true`, `useWSSecurity: false`, `autoconnect: false` (`:314-325`).
- Bounds: connect 3,000 ms, request 5,000 ms, 1 MiB received, 16 profiles, GOP bound 2,000 ms (`onvif-session.ts:62-73`); whole test 15,000 ms (`packages/shared/src/api/capture.ts:168`).
- Profile reading: a profile is "usable" with a token of the code form, a `videoSourceConfiguration` and a `videoEncoderConfiguration` (`onvif-session.ts:207-225`). `h264` is true only when `encoding === 'H264'` (`:222`). GOP is `govLength / frameRateLimit * 1000` read from the `H264` member or the encoder (`:219-221`); a GOP above 2,000 ms gives the warning `GOP_ABOVE_BOUND` (`:363`).
- Stream-URI handling: the test asks `getStreamUri({ protocol: 'RTSP', profileToken })` for ONE profile - the first H.264 profile, else the first usable one (`:477-482`). The address is compared and dropped: scheme must be `rtsp:` (`:237`), no `@` (`:238`), hostname must equal the candidate host (`:239`); failures are `STREAM_SCHEME`, `STREAM_USER_PART`, `STREAM_HOST_MISMATCH`, `STREAM_ADDRESS_MISSING` (`:83-100`, `:228-240`), all reported as outcome `WRONG_PROFILE` (`:489`). "No RTSP connection is opened: the stream address a device names is COMPARED and then dropped - never stored, never contacted" (`:11-13`).
- The H.264-only outcome: `if (h264.length === 0) return ended(NOT_H264, NO_H264_PROFILE)` (`onvif-session.ts:491`); otherwise `REACHABLE` with only the H.264 profile tokens in `usableProfiles` (`:492`, `:361`). A camera with H.264 and H.265 profiles is REACHABLE and lists the H.264 ones only.
- Tests that hold this: `camera/__tests__/onvif-session.test.ts:170,200` (`setDeviceMode('H265_ONLY')`), `modules/capture-discovery/connect/__tests__/connect.db.test.ts:313` (`'H265_ONLY', ACCOUNT, 'NOT_H264'`); test doubles `test/support/fake-onvif-stub.ts:24,144`, `test/support/lane-camera-stub.ts:65,154`.
- Where the outcome goes: `connect/service.ts:326` copies `usableProfiles` into the candidate profiles only on REACHABLE.
- `CameraAdapter.pullUrl(deviceId, profile)` is the locator member of the seam (`types.ts:143`); the locator form is host and path only, built by `streamLocator` (`credential.ts:105-108`). No production implementation exists (stub `onvif-rtsp.ts:35`).
- Target of a test: `camera/connection-target.ts:26-45` (IPv4 literal host, `http:`/`https:` service address with the candidate's own host, path pattern, port 1-65535); the same function builds the operator's confirmation text (`:54-62`).
- TLS: an `https:` service address is used with the certificate NOT checked, TLS 1.2 floor, and "the fake stub speaks no TLS, so that branch was never run" (`onvif-session.ts:42-44`; options at 279, 319).

## 7. The `local/` adapter as a built opener - S1 S3 S4

Pattern in `capture/adapters/local/`. Kind LOCAL_DEVICE, DEVELOPMENT class, `hasOpener: true` for both seams (`camera-adapter.ts:69`, `mic-adapter.ts:97`). Barrel not re-exported by the adapter layer; only the fence imports it (`local/index.ts:1-8`). Built per boot in `buildDevelopmentRegistry` (`capture/fence/index.ts:200-217`).

Camera (`camera-adapter.ts`, `camera-helper.ts`, `camera-helper-args.ts`):
- `openSource(deviceId, { ingestUrl }, signal)` starts a helper process "toward the worker's loopback listener" (`camera-adapter.ts:81-97`); `discover` answers nothing (71-74); `testConnection` is UNREACHABLE (76-79); `profiles` returns one H264 profile `H264_720P30` (99-102, `camera-helper-args.ts:30`); `pullUrl` refused (104-107); `ntpOffsetMs` is 0 (109-112); extras `presence`, `precheck`, `openSources`, `closeAll` (45-54).
- The helper is the FFmpeg command-line program (`camera-helper-args.ts:6`, "9.0.2 on this host"), started by absolute path through a process door: no shell, empty environment, stdin closed, 64 KiB bounded output (`process-door.ts:1-21`, `:27`), program-path rule (`helper-program.ts:18-44`).
- It PUSHES RTSP over TCP: `PUSH = ['-f','rtsp','-rtsp_transport','tcp']` (`camera-helper-args.ts:84`) to the plan's `ingestUrl`, which must match the loopback pattern and media-port range (`:97-102`). Device input `-f avfoundation -use_wallclock_as_timestamps 1 -framerate 30 -video_size 1280x720 -pixel_format nv12` (`:40`). The input format is macOS-specific.
- It ENCODES (`h264_videotoolbox` or `libx264`, `-g 30`, `-b:v 4M`, no audio `-an`; `camera-helper-args.ts:52-55`); it is not a stream copy. Timing options `-copyts -output_ts_offset -S -start_time_realtime S` (`:105-110`) so the worker can place frames (explained at `:18-22`).
- Order of an open: push target check, program path rule, device list read, exactly one name match, then start (`camera-helper.ts:10-17`); two start attempts 500 ms apart for a refused listener (`:124`); a helper that delivers no frame in 8 s is stopped (`:66`, `:124`); no restart, no fake replacement (`:19-22`).
- No credential is involved (`camera-adapter.ts:76-79`).

Microphone (`mic-adapter.ts`, `mic-helper.ts`, `mic-helper-args.ts`, `mic-pipe.ts`):
- `open()` PREPARES the transport (a named pipe `<runDir>/<sessionId>/MIC-NN.pcm`) and starts NO helper; `stream.start()` launches the helper after the worker accepted the plan (`mic-helper.ts:12-23`, skeleton `prepare` L166-267, `start` L198-245, `close` L247-262; `capture-session/index.ts:1105-1112`).
- Output line to the pipe: `-vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y` (`mic-helper-args.ts:71`) - 32-bit float, 48 kHz, mono, flushed per packet, "with no filter that collects samples" (`:24-27`). Input `-f avfoundation -i none:<name>` (`:58`, `:115-118`).
- `enumerate` reads the device list without opening (`mic-adapter.ts:100-104`); `level` answers the worker's telemetry value or null (`:114-117`).
- Pre-check short open (`mic-helper-args.ts:147-149`, `camera-helper-args.ts:143-146`).
- Search for ALSA, arecord, v4l2, pulse in `apps/core-server/src`, `apps/capture-worker/src`, `packages/capture-protocol/src`, `packages/shared/src` (`.ts .c .h`): no ALSA/Linux capture match (only false hits on `VisualSampleEntry`, `operator_credentials`, `recPulse`). No `Linux` mention in `capture/adapters/local/*.ts`.

Shared structure (the built-opener pattern, as fact): one process door, one program-path rule, one exact-name rule (`device-list.ts`), five named errors (`local/errors.ts`), one pinned argument table per helper with a static test that every argument is a literal (`CAMERA_HELPER_TABLE` `camera-helper-args.ts:152-156`, `MIC_HELPER_TABLE` `mic-helper-args.ts:165-172`), delivery watch on `-progress pipe:1` (`camera-helper.ts:41-107`).

## 8. Credential sealing - S1

- Operator input `CameraCredential { username, secret }`, "lives for one request" (`credential.ts:24-28`).
- `SealedCredential` is an opaque class: members are kept in a module-private `WeakMap` (`:34`, `:37-51`); `toString`, `toJSON` and inspect return the mark `[credential]` (`:31`, `:42-50`).
- Only `usingCredential(sealed, use)` (`:69-71`) and `credentialAtInjection(locator, sealed)` (`:122-125`) read it. The connection test uses `usingCredential` (`onvif-session.ts:346`).
- Stream locator is host-and-path only: `credentialFreeLocator` refuses `@`, query, fragment, trailing slash, non-`rtsp:` (`credential.ts:82-99`); `streamLocator` composes it (`:105-108`); `blankCredentialLocators` strips user parts from foreign text (`:135-137`).
- `credentialAtInjection` is the one place locator and credential meet, "handed to the channel that starts the process which opens the stream (the start message on its standard input: never an argument list, never an environment variable)" (`credential.ts:1-14`, `:117-125`). It has no caller in the product: static test A-2 (`adapters/__tests__/static.test.ts:121-125`).
- The plan carries no credential member: `CapturePlanCameraSchema` is a strict object of `deviceId, trackId, profile, ingestUrl, outputPath` (`packages/capture-protocol/src/index.ts:520-534`).
- Storage side (for row 4, not enumerated here): `connect/service.ts:202-211` (`operatorCredential`, `ContactPermit`), `:404` (`storeSealed` seam, `KEY_REF`), `credential-store/index.ts:8` (comment: key of a camera credential of operations 89 and 96, table `capture_device_credentials`), `credential-store/envelope.ts:109,126`, `db/schema/capture.ts:3-9` ("NO SELECT on `capture_device_credentials`").
- In the local helpers no credential is used (`camera-adapter.ts:76-79`; fake `fake/camera.ts:8` "It holds no credential").

## 9. Mic transport - S4

- One transport kind exists: `CaptureMicInputKind.PCM_FIFO`, "A named pipe the worker reads raw PCM from: 32-bit float, little-endian, at the plan's sample rate and channel count. Written by another process (a fixture, or an adapter process)" (`packages/capture-protocol/src/index.ts:326-333`).
- Statement `MIC_TRANSPORTS.PCM_FIFO`: `sampleFormat: 'F32LE'`, `sampleRateHz: CAPTURE_AUDIO_SAMPLE_RATE_HZ` (48,000), `channels: CAPTURE_AUDIO_CHANNELS` (1), `placement: 'ARRIVAL'`, `clockCompensationPpm: 5000`, `latenessBeyondRangeMs: 2000`, `reportsOutOfRange: false` (`capture/adapters/mic-transport.ts:45-59`, `:62-73`).
- Header states: "a transport for a real USB or network microphone is class C-4 and is not built" (`mic-transport.ts:7-10`); the worker places a microphone by arrival and resamples it continuously, at most +-5,000 ppm (`:11-22`); beyond the range a fast source becomes late by up to the 2,000 ms worker buffer and a slow one gets gaps, not reported (finding R-3, `:17-32`); the asked-for bound 100 ms is "not built" (`:41-42`).
- Pipe path `<runDir>/<sessionId>/<MIC-NN>.pcm` from `micPipePath` with strict id patterns (`mic-transport.ts:84-96`).
- The type of the statement field is a single literal `'F32LE'` (`mic-transport.ts:48`); `satisfies Record<CaptureMicInputKind, MicTransportStatement>` means a new kind needs a statement (`:73`).
- Worker side of the same pipe: item 12.

## 10. Capture plan shape - S5

Plan schema in `packages/capture-protocol/src/index.ts`; contract constants in `packages/shared/src/api/capture.ts`.

- Protocol version 4 (`index.ts:141`). Media port range 8554-8564 (`index.ts:147-148`).
- `CapturePlanCamera` (strict): `deviceId`, `trackId`, `profile: string(1..64)|null`, `ingestUrl` (must match `^rtsp://127.0.0.1:<port>/<path>`, no credentials, no trailing slash, port inside the media range), `outputPath` (absolute) (`index.ts:508-535`). No codec, resolution, rate or bitrate member.
- `CapturePlanMic` (strict): `deviceId`, `role`, `input` = discriminated union of one member `{ kind: 'PCM_FIFO', path }` (`index.ts:537-544`).
- `CapturePlanConstants` (strict): `fragmentTargetMs`, `minFragDurationMs`, `gopFrames`, `meterRateHz`, `audioSampleRateHz`, `audioChannels` (`index.ts:547-555`).
- `CapturePlan`: 1-2 cameras, 1-2 mics, `activeMic` role, `pcmTapPath|null`, `constants`; cross-checks for duplicate camera, track, ingest address, output file, mic, role, path (`index.ts:561-593`). `START` message carries `attempt` and the plan (`index.ts:602-608`).
- Values the Core puts in the constants: 2,000 ms fragment target, 2,000 ms minimum fragment duration, GOP 50 frames, meter 20 Hz, audio 48,000 Hz, 1 channel (`modules/capture-config/plan.ts:157-167`; values `packages/shared/src/api/capture.ts:41-59`, `:102`). Comment states the GOP is a target; "on the stream-copy path the camera's GOP is used and the worker verifies the OBSERVED keyframe interval" and warns above 2,000 ms (`packages/shared/src/api/capture.ts:14-26`, `:54-59`).
- Audio constants named for OD-06: `CAPTURE_AUDIO_SAMPLE_RATE_HZ = 48_000` "AAC-LC sample rate of the session audio (Hz); mono" and `CAPTURE_AUDIO_CHANNELS = 1` (`packages/shared/src/api/capture.ts:40-43`). `CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES = 1024`, `CAPTURE_AAC_FRAME_SAMPLES = 1024` (`:82`, `:95`).
- Plan builder (`modules/capture-config/plan.ts`): who decides ports and paths - the caller. The session start gives ingest URL `rtsp://127.0.0.1:{8554|8556}/<sessionId>/<track>` (`capture-session/index.ts:153`, `:1056`).
- The plan's `profile` is a free string; the Core's recorded codec is derived from the file, not from the plan: "THE FILE SAYS IT, NOT THE PLAN: the worker copies what the camera sends" (`capture/fragments.ts:446-451`).
- `plan.test.ts` covers the builder (named: `modules/capture-config/__tests__/plan.test.ts`).

## 11. Worker ingest and fMP4 mux: codec handling - S6

Files: `apps/capture-worker/src/ingest.c` (699 lines), `sink.c` (649), `capture_worker.c` (503), `worker.h` (348). Statement requested by the controller, stated plainly first:

### HEVC/H.265 statement

- **Handled by name: no.** A search over `apps/capture-worker` (`src`, `test`, `test-fixtures`, `check.sh`, `Makefile`, `README.md`) for `hevc`, `h265`, `h.265`, `265`, `hvc1`, `hev1`, `avc1`, `mp4 tag` returned no hit. Matches for `h264`/`h.264` exist only in tests (below). The only codec-bearing strings in `src/` are the AAC encoder lookup `avcodec_find_encoder_by_name("aac")` (`ingest.c:163`) and a log of the codec name `avcodec_get_name(is->codecpar->codec_id)` (`ingest.c:525-526`).
- **Refused by a codec test: no.** There is no comparison of `codec_id`, no codec switch, and no `codec_type` test beyond choosing the video stream. What the ingest requires of the video stream: a video stream exists (`av_find_best_stream(..., AVMEDIA_TYPE_VIDEO ...)`, `ingest.c:509-510`, else `INGEST_NO_VIDEO`); non-empty `extradata` (`ingest.c:512`, else `INGEST_NO_EXTRADATA`, "S1 SP-6: fail loudly"); packets with a pts (`:543-550`); the first written packet is a keyframe by `AV_PKT_FLAG_KEY` (`:632`); the camera's wall clock from PRFT side data or `start_time_realtime` (`:557-561`).
- **Tested: no.** The worker tests assert the output streams are `[("audio","aac"),("video","h264")]` (`test/m3worker.py:472` and `:1637`); the test camera sources are H.264 (`test-fixtures/fake_cam_sr.py:48-54` Annex B H.264, `:165` SDP `H264/90000`). No HEVC fixture exists in the worker folders.
- **Mechanism by which any codec reaches the mux:** `avcodec_parameters_copy(c->ov->codecpar, is->codecpar)` - "stream copy" - then `codec_tag = 0` (`ingest.c:361-362`), output context `avformat_alloc_output_context2(&c->out, NULL, "mp4", NULL)` (`:344`), movflags `+frag_keyframe+empty_moov+default_base_moof+skip_trailer` (`:47`, applied `:367`), `flush_packets=1` (`:368`), `min_frag_duration` (`:369`). Whether libavformat 9.0.2's mp4 muxer carries HEVC under these flags is a property of the installed FFmpeg; the worker is pinned to libavformat 63.1.102 (`ingest.c:58-59`) and the repository has no run of it with an HEVC stream.
- **Codec-neutral places (read, not codec-specific):** the writer's `parse_moov` reads track id, timescale and the handler type `vide` only (`sink.c:188-245`, video flag `:213-215`), not the sample entry; `parse_moof` reads keyframe status from `trun` flags (`sink.c:251-300`); GOP observation uses `AV_PKT_FLAG_KEY` (`ingest.c:632,682`, `gop_observe` `:249-263`).
- **Core side of the stored file (downstream of the worker):** the Core maps sample entries `avc1`, `avc3` to `H264` and `hvc1`, `hev1` to `HEVC` (`apps/core-server/src/capture/fragments.ts:453-459`); the nominal frame rate is read from the `avcC` parameter set only, and is null for "a codec whose parameter sets this Core does not read (HEVC: open item of fix 151)" (`fragments.ts:541-546`, `avcC` parse `:695-705`). `sealing-host` tests HEVC with synthetic boxes (`sealing-host/__tests__/sealing-host.test.ts:238-240`, `stream-profile.test.ts:98,365,378,400,403`). These are box-level tests, not a worker run.
- **Connection-test side:** the Core's test refuses a camera with no H.264 profile before any recording (item 6, `onvif-session.ts:491`).
- Summary in one line: for HEVC, the worker's repo code neither names it nor refuses it nor tests it; its behaviour under the pinned FFmpeg is unproven by anything in the repository.

### Ingest facts

- One thread per camera; RTSP LISTEN ingest on 127.0.0.1, video stream-copied into the camera's fMP4 (`ingest.c:1-8`). Options: `rtsp_flags=listen`, `listen_timeout`, `protocol_whitelist=tcp` ("W-1: no datagram socket") (`:481-484`); open call at `:490`. Only RTP over TCP can connect; the worker refuses UDP by whitelist (`:9-22`).
- Listen URL parse: `rtsp://127.0.0.1:<8554-8564>/<name>` (`capture_worker.c:110-124`).
- Video time is placed from the packet's PRFT side data (latest RTCP sender report) or `start_time_realtime` (`ingest.c:24-30`, `:557-561`); packets before the first sender report cannot be placed (`:574-580`); a camera clock more than the sanity bound away ends the ingest (`:583-590`, `:610-621`).
- Output stream layout: two streams, `ov` (video copy) and `oa` (audio from the AAC encoder context) (`ingest.c:357-365`); audio time base 1/SR (`:365`).
- Mux/file writer: append-only, one whole `moof`+`mdat` fragment at a time, hard-link publication (`sink.c:1-33`); fragment size bound 64 MiB default (`worker.h:67-73`).
- Fragments cut at keyframes under `frag_keyframe`; a size cut can start a fragment without a keyframe and is recorded `keyframe:false` (`ingest.c:268-281` comment, `:320-327`).
- Pre-start discards: packets before T0, without pts, without camera clock, or before the first keyframe are dropped and counted (`ingest.c:543-550`, `:566-571`, `:632-638`).

## 12. Worker audio path (`audio.c`) - S6 S4

- Mics: two inputs by plan, index 0 = PRIMARY, index 1 = STANDBY (`worker.h:78-79`); each is a named pipe opened `O_RDONLY | O_NONBLOCK | O_CLOEXEC` (`audio.c:359`); pipe contents are read as 4-byte floats (`audio.c:384-391`).
- Comment: "Each mic is a named pipe written by ANOTHER PROCESS (a fixture, later an adapter process): 32-bit float PCM, 48 kHz, mono" (`audio.c:42-44`). "This transport... is the FIXTURE's: the device adapter rows decide how a real microphone is read; what they inherit is this rule, not the pipe" (`audio.c:62-63`).
- Rate and channels are fixed at compile time: `#define SR 48000 /* AUDIO-01: AAC-LC 48 kHz mono (OD-06) */` (`worker.h:75`). The plan is refused if `audioSampleRateHz != SR` or `audioChannels != 1`: `PLAN_UNSUPPORTED` (`capture_worker.c:148-149`, "the worker records nothing else").
- Per-mic resampler: libswresample, input FLT mono SR to output FLT mono SR, with compensation (`audio.c:351-358`); clock correction up to `MIC_MAX_PPM` = 5000 (`audio.c:93-95`, `:464`); per-mic buffer two seconds (`audio.c:87`).
- Filter graph: `abuffer@mic1`, `abuffer@mic2` with `sample_rate=48000:sample_fmt=flt:channel_layout=mono:time_base=1/48000` into `astreamselect@asel=inputs=2:map=%d`, then `aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono` into `abuffersink` (`audio.c:231-237`); frame size AAC_FRAME 1024 (`:250`, `worker.h:77`). The selector passes ONE of the two mic inputs; the switch is a hard cut (`audio.c:16-34`).
- Encoder: AAC, `avcodec_find_encoder_by_name("aac")`, sample format FLTP, rate SR, bit rate 96,000, mono, global header (`ingest.c:162-175`). One encoder; its packets are cloned into every camera file (`audio.c:255-258`, `ingest.c:386-414`).
- Quantum 480 samples = 10 ms (`worker.h:76`).
- PCM tap (optional): signed 16-bit samples written to the tap path (`audio.c:308-324`; contract `packages/capture-protocol/src/index.ts:567-572`).
- Search for 24-bit/32-bit integer sample formats: grep for `AV_SAMPLE_FMT_S`, `s24`, `s32`, `24-bit` in `apps/capture-worker/src/*.c|*.h`, `packages/capture-protocol/src/index.ts`, `mic-transport.ts`, `mic-helper-args.ts` returned no hit. The only sample formats named are FLT, FLTP and S16 (tap).
- Mic health: `MIC_SILENT`, `MIC_DISCONNECTED`, `MIC_RATE_AT_LIMIT` warnings per device id (`audio.c:36-40`, `:215-229`).

## 13. One-open-session rule - S5 S6

- Supervisor: "It owns the one capture worker process of the one open session"; a second `start` while a session exists rejects `SESSION_OPEN` "a capture session is already open: one session at a time" (`capture/supervisor.ts:4`, `:1076-1078`).
- Database: `active_session_singleton_check` on `active_session` (`db/schema/sessions.ts:87`).
- Configuration lock while a session is open: `session_open` = exists an `active_session` whose state is not SEALED (`modules/capture-config/store.ts:59-61`), read into `locked` (`store.ts:162`); the registry's `resolve` and `assertAssignable` throw `CAPTURE_REGISTRY_LOCKED` when `locked()` (`registry.ts:107,129`; `types.ts:230`); decision label OD-10 (`errors.ts:20-21`).
- Capture session unit: "WHAT IT DOES, IN CAPTURE MODE `real`, FOR THE ONE OPEN SESSION" (`capture-session/index.ts:7`).
- Fixed per-track ingest ports `VIDEO-01 -> 8554`, `VIDEO-02 -> 8556` (`capture-session/index.ts:153`).
- A session has two camera tracks and two mic roles in the selector (shape check `modules/capture-config/plan.ts:121-126`); the plan allows 1-2 cameras (`index.ts:563`); slots VIDEO-01, VIDEO-02, MIC-PRIMARY, MIC-STANDBY (`capture/fence/sources.ts:34`).
- Worker plan limits: `NCAM 2`, `NMIC 2` (`worker.h:78-79`).

## Supporting units (not numbered in the row, needed for the map)

- **Session start/stop wiring** (`capture-session/index.ts`, 1,432 lines): at start, mics opened first (`:1038-1050`, `registry.resolve('MIC', id).open(id, { sessionId, signal })` at 1041), plan built (`:1067`), `supervisor.start(sessionId, plan)` called once (`:1103`), microphone helpers started after the worker accepts the plan (`:1112`), cameras opened toward the worker's listeners (`:1129-1141`, `openSource` at 1132), camera clock offset read via `ntpOffsetMs` (`:1143-1153`). One camera not opened is a degraded session (`:1137`). Source handles closed on every exit path (`:63-70`). Fixed `MIC_START_BOUND_MS` = 8,000 (`:127`). Facts file per session (`capture-session/facts.ts`, 318 lines; not opened beyond skeleton index).
- **capture-config module** (`modules/capture-config/`): operations 76-80 (`routes.ts:6-11`); plan builder `plan.ts`; lock read `store.ts:59-62,162`.
- **capture-inputs module** (`modules/capture-inputs/`): operation 97 `rescanCaptureInputs`, `POST /api/v1/capture/inputs/rescan`, re-reads the local microphone inputs by calling `AudioInputAdapter.enumerate()`; one entry per REGISTERED microphone (`routes.ts:8-11`, `index.ts:1-12`). The module is NOT in the app's unit list at the time the file was written (`index.ts:14-17`).
- **Fence / registries** (`capture/fence/`): operation decision `operation.ts:15-16,80`; development registry with the two local adapters and generated test sources (`index.ts:200-217`); production registry empty (`index.ts:326-329`); source-row builder `sources.ts`. A stored PRODUCTION device gets no adapter in a development registry (`index.ts:193-199`).
- **Device list rule:** a development-kind row is not listed in REAL_PRODUCTION (`fence/sources.ts:152-174`).
- **Camera loss/health at the adapter level:** `onSourceLost` callback of local adapters (`camera-adapter.ts:42,86-89`); no equivalent exists for the stubs.

## What was not examined

- `capture-session/facts.ts`, `statements.ts` bodies; `capture/supervisor.ts` beyond the lines cited; `modules/capture-discovery/connect/*` beyond cited lines; `modules/capture-discovery/search.ts`, `store.ts`, `limits.ts`; `camera/probe-answer.ts` beyond line 60; `camera/discovery-collector.ts` beyond line 80; `fake/*` bodies; `sink.c` beyond line 300; `ipc.c`, `micwatch.c`, `anchor.c`; the `test/` folders beyond cited lines; the worker `README.md` beyond a grep. These do not alter the statements above; they are the places to open if a row needs more.
- No claim is made about what the installed FFmpeg does with HEVC; none was run.

## Gaps / Needs Investigation

1. Behaviour of the worker with an HEVC stream under FFmpeg 9.0.2 (needs a run with an HEVC RTSP source; not run here).
2. Whether `onvif` package `getStreamUri` is asked for a transport: the call passes only `protocol: 'RTSP'` (`onvif-session.ts:482`); nothing in the Core states RTSP/TCP for a production camera, because no production opener exists.
3. `types.ts:9-20` header text and `onvif-rtsp.ts:2-8` header predate rows 131/142 and say the search/connection test are not built; the code in `onvif-discovery.ts` and `onvif-session.ts` is built.
4. No production caller of `loadProductionAdapters`; how REAL_PRODUCTION would get adapters is not wired (`fence/index.ts:319-329`).

---
*Generated: 2026-10-12 (clock time not available to this agent)*
*Last Updated: 2026-10-12*
