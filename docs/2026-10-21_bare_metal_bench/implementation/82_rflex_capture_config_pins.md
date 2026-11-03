# Row 136 - capture-config stored-camera pins to the global destination rule (R2.1, extended by D23)

Status: complete. Test files only; no production change. Narrative tier 3.

## (A) Reader pins (RM-N1..N4; masterplan/01_specs_rflex_register.md)
| File:line | Change | Cites |
|---|---|---|
| modules/capture-config/__tests__/credential-reader.test.ts:68-72 | `HOST` gains `interfaceSubnets` (eth1 192.168.50.1/24, eth0 10.20.0.5/24) | RM-N4 / RF-N7 (absent -> NOT_CONFIGURED) |
| credential-reader.test.ts:373-376 | CONTROL adds: 10.20.0.9 (office subnet) now served, 1 entry, 1 opening | RM-N1 lifted |
| credential-reader.test.ts:415-417 | `10.20.0.9 OTHER_INTERFACE_SUBNET` removed; `192.168.51.21` now `NO_SOURCE_INTERFACE` (was OUTSIDE_CAMERA_SUBNET) | RM-N1, RM-N2 |
| credential-reader.db.test.ts:53-57 | `HOST` gains `interfaceSubnets` | RM-N4 |
| credential-reader.db.test.ts:345-351 | title "another interface" -> "off-link"; `10.20.0.9 OTHER_INTERFACE_SUBNET` -> `192.168.51.21 NO_SOURCE_INTERFACE` | RM-N1 |
| camera-adapter-open.db.test.ts:109-113 | `HOST_FACTS` gains `interfaceSubnets` | RM-N4 |
| camera-adapter-open.db.test.ts:702-704 | `192.168.60.20` -> `NO_SOURCE_INTERFACE`; `10.20.0.77 OTHER_INTERFACE_SUBNET` removed from the refusal list | RM-N2, RM-N1 |
| adopted-camera-test.db.test.ts:145-149 | `HOST_FACTS` gains `interfaceSubnets` | RM-N4 |
| adopted-camera-test.db.test.ts:555-556 | 4th refusal `OUTSIDE_CAMERA_SUBNET` -> `NO_SOURCE_INTERFACE` | RM-N2 |

RG-9 (AD-02 loopback) assertions unchanged, quoted:
- credential-reader.test.ts:409 `['127.0.0.1', 'LOOPBACK'],`
- credential-reader.db.test.ts:348 `['127.0.0.1', 'LOOPBACK'],`
- camera-adapter-open.db.test.ts:695-696 ``[`${HOST}:${ONVIF_PORT}`, 'LOOPBACK'],`` / `['127.0.0.1', 'LOOPBACK'],`
- adopted-camera-test.db.test.ts:556 first element `'LOOPBACK'` (unchanged)

## (B) Fixture `mac` (RG-13, row 105 / 57_rflex_capture_config.md)
`mac: '02:00:00:00:00:e0'` (eth0) / `'02:00:00:00:00:e1'` (eth1, incl. alias/onPort/SCANNED addresses) on every non-loopback address literal, with a one-line citation comment:
- __tests__/capture-composition.db.test.ts:292-297, :589-596
- modules/capture-config/camera-network/__tests__/routes.db.test.ts:86-91
- modules/capture-config/factory-scan/__tests__/routes.db.test.ts:72-77

Additional pins in capture-composition.db.test.ts (owned file; needed for it to pass once eligible interfaces exist):
- :51-60 `HOST` gains `interfaceSubnets` (RM-N4).
- :333-334 stored OUTSIDE -> `NO_SOURCE_INTERFACE` (RM-N2); :338-340 typed 192.168.60.77 -> `NO_SOURCE_INTERFACE` (RM-N2), typed 10.20.0.77 -> allowed from 10.20.0.15 (RM-N1).
- :348-360 interface choice removed / no row: facts are a context with `cameraSubnet: null` (row 105, RF-N3); STORED_CAMERA/TYPED_PROBE allowed from eth1 for 192.168.50.x, off-link NO_SOURCE_INTERFACE, CAM-11 passes the gate (RM-N4). Test title :302 updated accordingly.

## Verification
- `npm test -w @dems/core-server -- src/modules/capture-config/__tests__/credential-reader.test.ts --maxWorkers=2` -> `Test Files 1 passed (1)`, `Tests 22 passed (22)`
- `lockf -k .data/locks/db-runner.lock npm run test:db -w @dems/core-server -- <the 3 reader db files + the 3 extension files> --maxWorkers=2` (outside sandbox) -> `Test Files 6 passed (6)`, `Tests 82 passed (82)`
- `lockf -k .data/locks/heavy-host.lock npm run typecheck -w @dems/core-server` -> `tsc --noEmit`, no errors

Deviations: none from spec; the capture-composition RM-N4 "no configuration" block was reworded from "everything refused" to the global answer (behaviour already landed by rows 102/105).
