---
task_id: 2026-10-21_bare_metal_bench
row: 109 (R2.1)
agent: coder-execution
date: 2026-10-22
status: complete
spec: masterplan/01_specs_rflex_network.md U7 (RM-N1, RM-N2, RM-N4, RF-N7); masterplan/01_specs_rflex_audio.md RQ-A1 (d), D-A3.5 (AU-L1)
narrative_tier: 3
---

# Row 109 - C55 header of the composition, composition tests on R-FLEX

## Change
- `apps/core-server/src/capture-composition.ts` (comments only, wiring unchanged per U7; no composition test showed a wiring gap)
  - Header member 1 (:17-33): global STORED_CAMERA / TYPED_PROBE rule over eligible interfaces (`interfaceSubnets`, NW-C1), `NO_SOURCE_INTERFACE` / `SOURCE_INTERFACE_AMBIGUOUS`; "no reader, or an unreadable host: every address refused" (`NOT_CONFIGURED`); "not configured" (no camera interface/subnet/address) no longer refuses a stored camera; commissioning scan and set-IP stay bound. Removed the stale "row 108 is not built" sentence.
  - Header member 4 (:38-44): op 98 answers `boundTo` by identity (AU-L1), op 99 refuses a bound card; composition only hands the enumerator.
  - Header member 5 (:45-51) and `READ_STORED_MICROPHONE` doc (:219-222): no port lock (row 107), port move keeps the binding, stored port only the `SERIAL_SHARED` tie-break, a pre-column row reads as "no serial".
- `apps/core-server/src/__tests__/capture-composition.test.ts`
  - `HOST` (:76-86) gains `interfaceSubnets` (eth1 192.168.50.1, eth0 10.20.0.5), same as the db file (row 136).
  - Fail-closed block: null / thrower / facts without `interfaceSubnets` -> every address refused, `NOT_CONFIGURED` for the camera address; `cameraSubnet: null` and `cameraAddresses: []` now ALLOW a stored camera from eth1 (:256-267).
  - Host-facts test (:269-289): 10.20.0.9 ALLOWED from 10.20.0.5 (was `OTHER_INTERFACE_SUBNET`); off-link `NO_SOURCE_INTERFACE`; second interface on the same /24 -> `SOURCE_INTERFACE_AMBIGUOUS`; read count `ADDRESSES.length + 6`.
  - Typed-probe test (:293-316): 10.20.0.77 allowed from 10.20.0.5; aliased factory address and 192.168.60.21 -> `NO_SOURCE_INTERFACE` (was `OUTSIDE_CAMERA_SUBNET`).
  - Statement test title (:474-475): port only a tie-break since R-FLEX. Skipped real-listing op-98 summary (:1057) also records `bound: card.boundTo !== null`.
- `apps/core-server/src/__tests__/capture-composition.db.test.ts`: header comment line 5 only (stale "product of today"). Row 136's changes (D-136 notes in 82_rflex_capture_config_pins.md: HOST `interfaceSubnets`, `mac`, NO_SOURCE_INTERFACE pins) untouched.

## Verification
| Command | Result |
|---|---|
| `npm test -w @dems/core-server -- src/__tests__/capture-composition.test.ts --maxWorkers=2` (before) | `Tests 3 failed \| 77 passed \| 1 skipped (81)` (global-rule pins) |
| same (after) | `Test Files 1 passed (1)`, `Tests 80 passed \| 1 skipped (81)` |
| `lockf -k .data/locks/heavy-host.lock npm run typecheck -w @dems/core-server` | `tsc --noEmit`, EXIT=0 (first run: 2x TS2554 in my new lines, fixed) |
| `lockf -k .data/locks/db-runner.lock npm run test:db -w @dems/core-server -- src/__tests__/capture-composition.db.test.ts --maxWorkers=2` (outside sandbox) | `Test Files 1 passed (1)`, `Tests 15 passed (15)` |

## Notes
- Load flake (not fixed, not mine): the two row-111b process tests (`capture-composition.test.ts` ~:1699 "DOES IT ANSWER", "UNKNOWN is thrown") timed out at 5000 ms twice while the host load average was 6-12 (once concurrent with the typecheck); they pass on the solo run. Recorded for row 115.
- No edits to `modules/capture-inputs/audio-cards` (row 108 in flight).
