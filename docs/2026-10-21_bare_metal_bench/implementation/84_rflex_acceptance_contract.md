---
task_id: 2026-10-21_bare_metal_bench
row: 138 (R2.1)
date: 2026-10-22
agent: coder-execution
status: complete
---

# Row 138: Core acceptance contract test on R-FLEX

File: `apps/core-server/test/acceptance/contract.test.ts` (Edit tool only; diff +25/-10). No other file touched.

## Baseline
Before any edit the file was already green on the R-FLEX tree: `Test Files 1 passed (1)`, `Tests 44 passed (44)` (openapi equality and the 111-operation pins included). The edits below add the R-FLEX assertions the row asks for.

## Changes
| file:line | Change |
|---|---|
| :1189-1190 | `Search` cards gain `boundTo`; `Registration` gains `releasedDeviceId` |
| :1192-1197 | op 98: every card `boundTo: null` before any registration (AU-L1) |
| :1212 | op 99 201 answer: `releasedDeviceId: null` (AU-B2) |
| :1220 | op 99 `release: 'true'` (not boolean) -> 422 INVALID_INPUT (AU-B1) |
| :1222-1223 | op 98 after registration: SIX `boundTo` = the new MIC id, DUO null |
| :1224-1233 | op 99 input 4 of the held card -> 409 INVALID_STATE `{reason: AUDIO_CARD_ALREADY_BOUND, deviceId: <holder>}` (AU-R1); with `release: true` -> 200 REENABLED, same deviceId, inputNumber 4, `releasedDeviceId` = holder (bundle M, D16 Q96-02-M); op 98 then lists the holder at input 4 |
| :1267-1268, :1312-1313, :1424-1425 | D23 / RG-13: `mac: '02:00:5E:00:53:01'` on every non-loopback HostInterface address literal (eth1 192.168.50.1 and the alias address `onPort`) in areas 101/102, 103 (scan), 106/107 (set-IP). Loopback literals unchanged |

Not changed (already compliant):
- TYPED_PROBE: the file has no `COMMISSIONING_NOT_CONFIGURED` (grep 0 hits); the typed-address refusal stays `{in: 'body', reason: 'DISCOVERY_ADDRESS_NOT_ALLOWED'}` (:974).
- `interfaceSubnets`: the file holds no TP/SC facts literal; facts are built by the product's builder from the interface tables, which now state `mac`, so no fixture needs it.
- openapi equality (:643 area) and the 111-operation pins (:539-542): pass unchanged after row 100's regeneration.

## Tests (db project: `test/acceptance/**` is in the `db` project, apps/core-server/vitest.config.ts:18; run outside the sandbox under the db-runner lock)
| Command | Result |
|---|---|
| `lockf db-runner.lock npm run test:db -w @dems/core-server -- test/acceptance/contract.test.ts --maxWorkers=2` (before edits) | Test Files 1 passed (1); Tests 44 passed (44) |
| same (after edits) | Test Files 1 passed (1); Tests 44 passed (44) |
| `lockf db-runner.lock npm run test:db -w @dems/core-server -- test/acceptance/rbac-matrix.test.ts --maxWorkers=2` (file unmodified) | Test Files 1 passed (1); Tests 39 passed (39) |
| `lockf heavy-host.lock npm run typecheck -w @dems/core-server` (includes `test/`) | exit 0 |

## Decisions / deviations
- D-138-1 The release case is exercised on input 4 of the same card (SIX), the bundle-M move: holder keeps its id, no new microphone, so the later registry pins (MIC-01, MIC-02, MIC-03; :2615 area) stay valid.
- No task-4 (non R-FLEX) failure observed in these two files.
