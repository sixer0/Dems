# 76 - R-FLEX row 130: audio-cards statements DB-A2 and DB-A6

Status: complete. Tier 3. Date 2026-10-22. Agent: coder-execution.

## What changed
| File | Line | Change |
|---|---|---|
| apps/core-server/src/modules/capture-inputs/audio-cards/statements.ts | :67-71 | NEW `READ_BOUND_AUDIO_INPUTS` (DB-A2): live rows of one USB id (`$1`) carrying a serial or a port; `WHERE i.usb_id = $1 AND i.retired_at IS NULL AND (usb_serial IS NOT NULL OR usb_port IS NOT NULL) ORDER BY i.device_id`. SQL as in 01_specs_rflex_database.md 3.2 |
| same | :85-87 | NEW `REKEY_AUDIO_INPUT` (DB-A6): `UPDATE ... SET usb_id=$2, usb_serial=$3, usb_port=$4, card_id=$5, card_device=$6, input_number=$7, updated_by=$8, updated_at=$9 WHERE device_id=$1 AND retired_at IS NULL` |
| same | :90 | `CAPTURE_AUDIO_CARD_WRITES` = [INSERT, REFRESH, REKEY] |
| apps/core-server/src/modules/capture-inputs/audio-cards/store.ts | :11 | imports the two statements |
| same | :79-99 | `MicrophoneStore.boundInputs?` / `rekeyInput?` (OPTIONAL), types `BoundAudioInput`, `AudioInputRekey` |
| same | :103-104 | `MicrophoneRowMissing.statement` gains `'REKEY_INPUT'` |
| same | :133 | `cardIdentityValuesOf` takes `Pick<AudioInputFacts,'usbId'|'usbSerial'|'usbPort'>` (wider, callers unchanged) |
| same | :166-173 | real store: `boundInputs` (identity texts through `cardIdentityText`), `rekeyInput` (row count must be 1) |

## Grant check (REKEY writes only granted columns)
- 0016_capture_streams_audio_inputs_privileges.sql:35-36: `GRANT UPDATE (usb_id, card_id, card_device, input_number, native_channels, sample_bits, updated_by, updated_at) ON capture_audio_inputs TO dems_app`
- 0018_network_commissioning_privileges.sql:40: `GRANT UPDATE (usb_serial, usb_port) ON capture_audio_inputs TO dems_app`
- REKEY sets: usb_id, usb_serial, usb_port, card_id, card_device, input_number, updated_by, updated_at - all 8 within the 10 granted. Not set: device_id, sample_rate (revoked 0016:38), retired_at. `retired_at` is only read in WHERE (SELECT granted 0016:33). No migration (D16 Q96-07).

## Tests (verbatim counts)
| Command | Result |
|---|---|
| `npm test -w @dems/core-server -- src/modules/capture-config/__tests__/selector-reader-inventory.test.ts --maxWorkers=2` | Test Files 1 passed (1); Tests 12 passed (12) |
| `/usr/bin/lockf -k .../db-runner.lock npm run test:db -w @dems/core-server -- src/engine/__tests__/readdress-door.db.test.ts --maxWorkers=2` | Test Files 1 passed (1); Tests 5 passed (5) |
| `lockf heavy-host.lock npm run typecheck -w @dems/core-server` | exit 2 - 0 errors in statements.ts/store.ts; 6 errors in files NOT owned (below) |
| (extra) `npm test ... audio-cards/__tests__/service.test.ts` | 3 failed / 25 passed - `CaptureAudioCardSearchSchema.safeParse` false (service.test.ts:261, :290, :348): shared contract now requires `boundTo` / `releasedDeviceId`, service.ts not yet updated (row 131). Not caused by this row |

Typecheck errors outside the ownership area (rule 8, not fixed):
- src/modules/capture-inputs/audio-cards/service.ts(299,3) TS2741 `boundTo` missing; (532,5) TS2741 `releasedDeviceId` missing - shared API change, owner row 131.
- src/capture/adapters/audio/__tests__/macos-card-listing.test.ts(867,877,889,890) TS2339 `PORT_DIFFERS` / `IDENTITY_NOT_STORED` not on the reason object - another parallel row.

Neither pinned test needed an edit: neither names `CAPTURE_AUDIO_CARD_WRITES`; readdress-door pins `capture_devices` writers only (REKEY writes `capture_audio_inputs`).

## Decisions / deviations
- D-130-1: `boundInputs`/`rekeyInput` are OPTIONAL on `MicrophoneStore` so the test doubles in service.test.ts:135 and routes.db.test.ts:85 (not owned) stay type-whole; row 131 makes them required when it wires them.
- D-130-2: REKEY does not set native_channels/sample_bits (register DB-A6: key + identity columns only); a port move that also changes facts can follow with REFRESH in the same unit.
- Not done (outside brief): D-A3.4 `retired_at IS NULL` on READ_REGISTERED_AUDIO_INPUTS / READ_AUDIO_INPUT_OF_CARD (assigned to rows 91/108 per spec). `index.ts` re-export of the new names not done (not owned; row 131 uses `./statements`/`./store` directly).
