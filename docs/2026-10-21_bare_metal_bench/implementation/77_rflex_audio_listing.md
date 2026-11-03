# 77 - R-FLEX row 131 (R2.1): matchStoredCard without port lock, op 98 boundTo by identity, op 99 exclusivity + bundle-M release

Status: complete (needs-review on one filed gap, see Decisions D-131-3). Tier 3. Date 2026-10-22. Agent: coder-execution.
Spec: masterplan/01_specs_rflex.md 5.1; 01_specs_rflex_audio.md 3-6, 10; register RM-A2, RM-A4, RM-A5, AU-R1, AU-R3, AU-L1, AU-B1, AU-B2, AU-A1, DB-A2, DB-A6. User: D16 (Q96-01 a, Q96-02-M, Q96-03 a, Q96-09 a); D18 (row 99 deviation).

## What changed
| File | Line | Change |
|---|---|---|
| apps/core-server/src/modules/capture-inputs/audio-cards/service.ts | :35-60 | header: identity rule without port, physical-card exclusivity, release, port move, no extra lock (units serial) |
| same | :213-217 | RM-A5 text "states no USB ID"; `inputTaken` (AUDIO_INPUT_NOT_REGISTRABLE, R-3 key collision); `alreadyBound` 409 INVALID_STATE `{reason: AUDIO_CARD_ALREADY_BOUND, deviceId}` (AU-R1) |
| same | :311-338 | `cardAnswer`: `boundTo` (AU-L1) and `registered[]` BY IDENTITY over DB-A2 live rows (USB cards); non-USB cards by key |
| same | :354-361 | op 98 reads `boundInputs` once per distinct USB id of the listing |
| same | :405-416 | `StoredCardMatch`: PORT_DIFFERS (RM-A2) and IDENTITY_NOT_STORED (RM-A4) removed; NOT_TELLABLE widened (AU-R3) |
| same | :449-469 | `matchStoredCard`: serial branch unchanged (port = tie-break only); no serial stored -> any serial-less unit on any port = SAME_CARD; a second serial-less unit on another card id = NOT_TELLABLE |
| same | :475-483 | `holdsCard` (SAME_CARD, or NOT_TELLABLE when no other listed unit is SAME_CARD), `boundIdentityOf` |
| same | :491 | RM-A5 predicate: USB id is the replacement word `0000:0000` (literal; card-listing import forbidden by rule A-5) |
| same | :534-597 | op 99 unit: holders via DB-A2 (minus the row under the key); none -> REGISTERED / REENABLED / CARD_CHANGED as before; same card at same input under another key -> port move: REKEY + REFRESH, REENABLED, no release; otherwise no `release` -> 409 ALREADY_BOUND; `release: true` -> audit RELEASED (old input), REKEY, REFRESH, re-enable, audit REENABLED (new input), 200, `releasedDeviceId` = holder; target key taken or >1 other holder -> rollback AUDIO_INPUT_NOT_REGISTRABLE |
| same | :601, :606 | log note carries `releasedDeviceId` (id only); answer always carries `releasedDeviceId` (clears typecheck :299 and :533) |
| apps/core-server/src/modules/capture-inputs/audio-cards/store.ts | :79-85 | `boundInputs` / `rekeyInput` REQUIRED (D-130-1 closed) |
| .../audio-cards/__tests__/service.test.ts | rig, op 99, row 156 block, row 199 block | stand-in store gains `boundInputs` (mirrors DB-A2 SQL incl. its filter) and `rekeyInput`; T-1 runs the shared case table; T-9/T-10, T-6/T-7/T-8 (macOS move), R-3, AU-R3, Q96-09, T-16 at unit level; old table turned; one `it.fails` KNOWN GAP (D-131-3) |
| .../audio-cards/__tests__/routes.db.test.ts | op 98/99, row 199 block, session control | `boundTo` + `releasedDeviceId` in answers; T-6, T-7/T-8, T-9/T-10 on PostgreSQL as dems_app (REKEY grants exercised); legacy row read as "no serial"; session-open control moved to an unheld card |
| .../audio-cards/__tests__/fixtures.ts | end | `INTERFACE_UNREAD_USB_ID`, `UNREAD_USB_ID`, `SIX_MOVED_CARD_ID`, `INTERFACE_MOVED_AND_RENAMED`, `DUO_MOVED_CARD_ID`, `TWO_CARDS_DUO_RENAMED` |
| capture-config/__tests__/e2e/first-full-session.db.test.ts | - | not changed: it asserts no op-98 card object |

grep: `PORT_DIFFERS` 0 hits in service.ts, service.test.ts, routes.db.test.ts.

## Tests (verbatim)
| Command | Result |
|---|---|
| `npm test -w @dems/core-server -- src/modules/capture-inputs/audio-cards/__tests__/service.test.ts --maxWorkers=2` | Test Files 1 passed (1); Tests 32 passed, 1 expected fail (33) |
| `npm test -w @dems/core-server -- test/static/imports.test.ts src/modules/capture-inputs --maxWorkers=2` | Test Files 3 passed (3); Tests 60 passed, 1 expected fail (61) |
| `lockf db-runner.lock npm run test:db -w @dems/core-server -- .../audio-cards/__tests__/routes.db.test.ts --maxWorkers=2` (outside sandbox: EPERM to 127.0.0.1:4432 inside) | Test Files 1 passed (1); Tests 24 passed (24) |
| `lockf db-runner.lock npm run test:db -w @dems/core-server -- .../e2e/first-full-session.db.test.ts --maxWorkers=2` | Tests 1 failed, 2 passed, 4 skipped (7) - NOT row 131: `r89_door_late` expects boot refusal `CAPTURE_HOST_FACTS_NOT_HANDED_IN`, receives `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` (first-full-session.db.test.ts:260; a boot check of another row, not audio) |
| `lockf heavy-host.lock npm run typecheck -w @dems/core-server` | exit 0, 0 errors (whole workspace) |

## Decisions / deviations
- D-131-1 `holdsCard`: NOT_TELLABLE holds only when no other listed unit is SAME_CARD for that row; so serial-less twins are both bound (Q96-03 i+iii) while a shared-serial twin on another port stays free (the stored port tie-break decides).
- D-131-2 Port move (same card, same device index and input, other key) needs no `release` and answers `releasedDeviceId: null`; a NOT_TELLABLE holder never takes the port-move path (refused unless `release`). Port move and release do REKEY then REFRESH (channel count / sample bits follow, D-130-2).
- D-131-3 GAP, filed (file_requests.md, blocking no): DB-A2 SQL keeps `AND (usb_serial IS NOT NULL OR usb_port IS NOT NULL)` (bundle-C rule). Under bundle M + Q96-09 + T-16 a serial-less port-less row holds its card but is invisible to op 98 and the op 99 check. Pinned as `it.fails` in service.test.ts; stand-in and SQL flip together. Bench BOMGE states port 1-1, so the bench path is unaffected.
- D-131-4 `release: true` with more than one other holder (pre-existing double binding, e.g. the e2e seed MIC-11/12) rolls back AUDIO_INPUT_NOT_REGISTRABLE instead of moving one and leaving two bindings.
- D-131-5 Op 98 registered[] = holder rows with SAME_CARD on this capture device; under NOT_TELLABLE `boundTo` is set and `registered` is empty.
- Not done (outside area): `index.ts` re-export of new store types; D-A3.4 `retired_at` filter on READ_REGISTERED / READ_AUDIO_INPUT_OF_CARD (rows 91/108).
