---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 131
date: 2026-10-09
agent: coder-execution
status: complete
tier: 3
---

# Row 131 — ONVIF WS-Discovery behind `CameraAdapter.discover()` (probe only, R-9)

Paths are under `apps/core-server/` unless they start with another folder.

## 1. What was built

| File | What it is |
|---|---|
| `src/capture/adapters/camera/ws-discovery.ts` | The ONE datagram socket of the Core. `createWsDiscovery` (:135): one `udp4` socket per search (`createSocket`, :262), port 0, bound to the one eligible interface (several: no address, probes once per interface, at most 4); TTL 1; two typed Probes (`tds:Device`, `dn:NetworkVideoTransmitter`) to `239.255.255.250:3702`, repeated after 250 ms; window from the first datagram; every way out goes through `finish` (:176), the only place that closes; the datagram handler is one `try` / `catch` (:250). No group joined, no TCP, no log, no file |
| `src/capture/adapters/camera/probe-answer.ts` | Reading one answer, pure. `readProbeAnswer` (:253): 16 KiB cap on the byte length, `<!DOCTYPE` / `<!ENTITY` refused on the bytes, nesting depth counted by a loop (limit 24), `xml2js` with pinned options (:81), fixed-path reads only. `cleanDeviceText` (:114, SEC35-48). `serviceAddressFor` (:320, DS-9 and SEC35-32 (2)) |
| `src/capture/adapters/camera/discovery-collector.ts` | What a search keeps, pure. `selectInterfaces` (:63, DS-4), `sourceRefusal` (:100, on-link only; own, network, broadcast, multicast, unspecified addresses refused), `createDiscoveryCollector` (:207): `RelatesTo` match, responder = (source, endpoint reference), conflict rule, 64-responder cap with registered first, 256-datagram cap, 2 KiB per candidate, counts by reason name |
| `src/capture/adapters/camera/onvif-discovery.ts` | `createOnvifDiscoveryAdapter` (:32): a `CameraAdapter` of kind `ONVIF_RTSP`, no device, no opener. `discover()` is the probe; `testConnection` refuses `CAPTURE_ADAPTER_CLASS_C` until row 142 |
| `src/capture/adapters/camera/xml2js.d.ts` | The surface of `xml2js` the Core uses (the package ships no types; no types package is named by the spec) |
| `src/capture/adapters/camera/__tests__/` | `support.ts` (loopback guard, fixture datagrams, socket snapshot), four test files, `lan-probe.ts` (the real-LAN harness, run by hand) |

Real: all of the above, on real sockets. Stand-in: nothing in the product; in tests the network is the fake ONVIF stub of row 60 on 127.0.0.1 and fixture datagrams.

**Result shape.** `discover()` resolves `{ candidates, responderCount, interfaceCount, truncated, counts }`. A candidate carries the seam's members plus `reason`, `registered`, `addressChanged`, `types`, `profileHints`, `locationHints`, `macHint`, `serialHint`. `counts` are numbers and reason names only (DS-12); the adapter writes no log. "Could not run" is a rejection with `DiscoveryNotRunError` (`NO_ELIGIBLE_INTERFACE`, `SOCKET_ERROR`), never an empty list (DS-13).

## 2. Install (Q-INSTALL item 6; `M4-SEC-DEP-1`)

- Command, under `/usr/bin/lockf -k .locks/npm.lock`: `npm install --save-exact --ignore-scripts --no-audit --no-fund -w @dems/core-server onvif@0.8.3 xml2js@0.6.2`.
- First attempt failed: `npm error code EPERM ... Your cache folder contains root-owned files` (`~/.npm`). No sudo. Retried ONCE with `--cache "$PWD/.cache/npm-row131"` (git-ignored): `added 5 packages in 3s`.
- Manifest: `"onvif": "0.8.3"`, `"xml2js": "0.6.2"` (exact). Lockfile: +58 lines, 5 entries (`onvif`; `xml2js` 0.6.2 and `xmlbuilder` 11.0.1, each under `apps/core-server/node_modules/` and under `node_modules/onvif/node_modules/`). `sax` 1.6.1 was present. The hoisted `xml2js` 0.6.0 of another workspace is unchanged.
- `onvif` integrity in the lockfile: `sha512-55gkQKRH…EFL+tw==` = the value row 126 reviewed (`09_security_design_review.md:488`).
- Size on disk (`du -sk`): `node_modules/onvif` 3,976 KiB with its nested copies; `apps/core-server/node_modules/xml2js` 3,384 KiB; `xmlbuilder` 276 KiB. Uninstall: `npm uninstall -w @dems/core-server onvif xml2js`.
- X-DEP-1 after the install: `npm audit` high 53 (baseline 54), `--omit=dev` high 46 (baseline 51), critical 0; none of the four packages is flagged; `undici` 7.29.1 (override) and 8.11.2.
- Licences read from the installed packages and appended to `THIRD_PARTY_NOTICES.md`: `onvif` MIT, `xml2js` MIT, `sax` BlueOak-1.0.0, `xmlbuilder` MIT.
- `onvif` is imported by NO file (first user: row 142). Its `Discovery` is not used.

## 3. Checks and results

Commands (unit project; loopback binding needs the sandbox off):
`npx vitest run --root apps/core-server --project unit src/capture/adapters/camera/__tests__/` -> 4 files, 68 tests passed.

| Check | Where | Result | Negative control |
|---|---|---|---|
| `M4-DISC-NOLAN-1` | `ws-discovery.test.ts`, loopback guard of `support.ts` | pass: every datagram of the search and stub goes to 127.0.0.1, 0 TCP connections | a search left on the product's multicast target is refused by the guard before a datagram is sent -> `DiscoveryNotRunError/SOCKET_ERROR`, 0 probes at the stub |
| `M4-DISC-SOCK-1` | `ws-discovery.test.ts` (`lsof` on the test process, relative to the stub's own socket) | 0 / 1 / 0; 0 after abort, refused bind, refused send, throwing reader, no interface, datagram cap | a socket left open reads 1; mutation "no close in `finish`" turned 2 tests red |
| `M4-SEC-NET-1` (dgram half) | `test/static/network.test.ts:151` | pass | planted third importer and a second module in the pinned file are found |
| `M4-SEC-DISC-1` | `probe-answer.test.ts`, `ws-discovery.test.ts` | every ST-2 case, 2,300-level nesting, 1,300 attributes, DOCTYPE / ENTITY, `__proto__` / `constructor`, a reader made to throw: 0 uncaught, search completes. Heap growth over 2,100 hostile answers with the collector exposed (one-off, `node --expose-gc`): 186,096 bytes | child-process double without the `try` / `catch` exits 1; mutation "handler without try / catch" turned the test red |
| `M4-SEC-DISC-2` | `discovery-collector.test.ts` | clone from a second address -> 2 rows, both `conflict`, 0 testable (both arrival orders); 252 responders -> 64, registered first, `truncated`; own / network / broadcast / multicast / unspecified / off-link source dropped and counted; repeat counted, not listed; `addressChanged` | each rule has its control case; mutations "no `RelatesTo` check" and "no source check" turned 4 tests red |
| `M4-SEC-DISC-3` (2 runs) | `discovery-recording.test.ts` | 2 of 2 passed: 9 hostile modes plus the throwing reader during a fake-worker `RECORDING` session; fragments contiguous and advancing during each search, 0 `CAPTURE_FAULT`, no worker lost, same process, clean stop | the same measurements read the opposite on a gap, a lost worker, a raised fault |
| `M4-SEC-DISC-4` | `ws-discovery.test.ts`; static block G-R9 | two fake interfaces -> `interfaceCount` 2, 8 probes, no interface name or address in the result; literal `udp4`; the discovery files hold no log call | one interface reads 1; planted `console.` / file write found |
| `M4-SEC-TXT-1` | `probe-answer.test.ts` | markup stays text; control, direction-override, zero-width characters removed; 5,000 characters -> 120 | unchanged text within the bound |
| `M4-SEC-DEP-1` | section 2; `probe-answer.test.ts` (pinned versions) | pass | — |
| `M4-SR-1` (G-R9, G-R13) | `src/capture/__tests__/static.test.ts:227`, `:321` | pass | planted violations found for each rule |
| `M4-DISC-STUB-1` (adapter half) | `ws-discovery.test.ts` | N = 0, 1, 3 -> N candidates from the answer alone; stub log: probes only, 0 device, 0 RTSP, 0 authenticated, 0 violations | a silent stub reads 0 |
| `M4-DISC-LAN-1` (2 runs) | `lan-probe.ts`, outside the sandbox | run 1: `FOUND (25)`; run 2: `FOUND (25)` | before each run the harness read 2 on a stub set to 2 and 0 on a stub set to 0 |

`M4-DISC-LAN-1`, both runs identical: 1 eligible interface, 4 probes accepted, 0 send errors, interface output counter rose by at least 4, sockets 0 / 1 / 0, 0 TCP connections, 0 destinations other than the group, 100 datagrams received and accepted, 0 dropped, 0 handler errors, 25 responders, 25 testable, 0 conflict, not truncated, 3 distinct hardware hints, 25 with a name hint. Model class, as counts read from the result file: 25 of 25 announce `dn:NetworkVideoTransmitter`, 24 of 25 also `tds:Device` (network video devices); 25 carry a hardware hint and 25 a manufacturer hint in a non-standard scope; all are kind `ONVIF_RTSP`. Identifying results are in git-ignored `.data/discovery/row131-lan-run-{1,2}.json` only; the tool output held counts only. No connection, no authentication, no configuration call was made.

Workspace gate: `tsc --noEmit` — 0 errors in this row's files (1 error left, `src/capture/__tests__/records.test.ts:27`, from the in-flight capture-protocol change). `oxlint` — 0 warnings in this row's files. Static guards: 10 red tests, none from this row: `local/**` files (rows 134 / 135: pinned list, G-R2, G-R8, `credentials.test.ts`), `modules/capture-config` (row 66: `imports.test.ts`, rule A-5), `src/transcription` (row 78: `imports.test.ts`, `log-calls.test.ts`).

## 4. What is not proven

- "Passes with the network cable out" is shown by the guard (no destination but 127.0.0.1 is handed to the operating system), not by taking the interface down.
- `M4-DISC-SOCK-1` and `M4-SEC-DISC-3` ran at adapter level in the test process; the booted-Core form and the database half (`recording_fragments` analyser) belong to rows 132 / 70.
- The heap bound inside the test file is 64 MiB when the runner exposes no collector; the 8 MiB bound was measured once by hand (figure above).
- Several interfaces on a real network (wildcard bind, `setMulticastInterface`) ran only on the loopback fixture; this Mac had one eligible interface.
- H-7a on real devices: 25 devices answered and each answer carried a reference, a name and a hardware hint. Whether every camera on the network answered is not known.

## 5. To wire when later rows land

- Row 132: build the adapter with `newMessageId` (the platform's random UUID), the capture timers, and `registered` (its registry lookup); add its two call sites to `DISCOVER_CALL_SITES` (`src/capture/__tests__/static.test.ts`); mint `candidateId`; write the counts to the log and the audit row; measure the duration; pass `CAPTURE_DISCOVERY_WINDOW_MS`. The exports it needs are requested in `delegation_progress/file_requests.md`.
- Row 132 lane launcher (test support): passes `loopbackFixture`; no file under `src/` may (pinned).
- Row 142: `onvif-session.ts`; adds its file to `OUTBOUND_EXEMPTIONS` (`test/static/network.test.ts`) and writes G-R10, G-R11.
- Lift of the 409 during `RECORDING`: `M4-SEC-DISC-1` and `M4-SEC-DISC-3` are PASS here (2 runs); the +1 and the gate artifact are rows 132 / 70.

## 6. Device and browser checks left for the gate

None of this row runs on a device. For the consolidated session: `M4-DISC-LAN-1` +1 through op 93 on a booted Core (row 70); `M4-DISC-W`, `M4-DISC-T` / `-P` (rows 137, 138).

## 7. Decisions taken (for the controller)

1. **Four files, not one.** The socket is in the one pinned file; the parser and the collector are two pure files beside it (testable without a socket). `xml2js` is imported by `probe-answer.ts` only, pinned in G-R9. The spec's "about 200 lines in one file" is not met: 292 + 335 + 323 lines.
2. **A separate search adapter.** `onvif-rtsp.ts` (class C) may import nothing but the layer's vocabulary (rule A-1), so `discover()` lives in `onvif-discovery.ts`, kind `ONVIF_RTSP`, no device.
3. **Responder = (source address, endpoint reference).** The same pair again is a repeat (counted). Two references from one address, or one reference from two addresses, are all listed with `conflict`. Consequence on the stub: N > 1 stub devices answer from one loopback address and are therefore listed as conflicting and not testable; N = 1 is testable. If rows 137 / 142 need several testable stub devices, the stub (row 60) must answer from one socket per device and the fixture rule must key on the port.
4. **Message IDs and timers are injected** (G-R8: the capture folder draws no random number and names no timer). `registered` is injected too; a lookup that throws lists the device as not registered and is counted.
5. **Wildcard bind without the literal:** with several interfaces the socket is bound with no address (the network guard forbids the wildcard literal in production sources).
6. **Edits in two guard files this row does not own by path** (`src/capture/__tests__/static.test.ts`, `test/static/network.test.ts`): made because the row's Verification cell assigns G-R9, G-R13 and the dgram half of `M4-SEC-NET-1`; logged in `file_requests.md` for review.
7. **`masterplan/02_plan.md` and `status_tasks.md` were not edited** (D94: controller's files in this wave).
8. **Depth limit 24 and 8 `ProbeMatch` children per message** are this row's constants; the spec names the caps without the figures.
