# 60 - R-FLEX row 108 (R2.1, extended by D24): op-99 exclusivity enforced and proven; DB-A2 filter dropped

Status: complete (one deviation, X-2 slot order, filed). Tier 3. Date 2026-10-22. Agent: coder-execution.
Spec: masterplan/01_specs_rflex.md 5.1 steps 1-6, RF-A3, RF-A4, X-1, X-2; 01_specs_rflex_audio.md D-A3.4, T-8..T-12. Builds on row 131 (implementation/77, D-131-1..5). Controller decision D24.

## What changed
| File | Line | Change |
|---|---|---|
| apps/core-server/src/modules/capture-inputs/audio-cards/statements.ts | :81-82 | DB-A2 `READ_BOUND_AUDIO_INPUTS`: predicate `AND (usb_serial IS NOT NULL OR usb_port IS NOT NULL)` dropped (D24); `retired_at IS NULL` and `ORDER BY i.device_id` kept; comment :64-76 |
| same | :35, :45 | D-A3.4: `retired_at IS NULL` added to `READ_REGISTERED_AUDIO_INPUTS` and `READ_AUDIO_INPUT_OF_CARD` (a retired row neither holds nor occupies its key; unique key is partial on live rows, 0032:7) |
| same | :97 | `REKEY_AUDIO_INPUT` unchanged: writes only granted columns (0016, 0018); pinned by a new assertion |
| apps/core-server/src/modules/capture-inputs/audio-cards/service.ts | :555-561 | step 1: `everyHolder` (all live holders incl. the row under the key, MIC id order) and `holders` (the others) |
| same | :592-602 | steps 2-5 labelled; X-2: more than one holder -> 409 AUDIO_CARD_ALREADY_BOUND naming `everyHolder[0]` (was: AUDIO_INPUT_NOT_REGISTRABLE, D-131-4); step 5 R-3 `existing !== null` -> AUDIO_INPUT_NOT_REGISTRABLE kept |
| same | :57-59 | header: X-2 and retired-row rules |
| apps/core-server/src/modules/capture-inputs/audio-cards/store.ts | :79-83 | `boundInputs` doc only |
| .../audio-cards/__tests__/service.test.ts | :78, :142-176 | stand-in: `retiredAt` on a row; every read filters live rows; `boundInputs` mirrors the new SQL (no serial/port filter) |
| same | :581-584 | "no identity stored" case turned: op 98 now names the holder (`['MIC-03', []]` x2) |
| same | :603-616 | former `it.fails` DB-A2 KNOWN GAP is a passing `it` (+ op 98 boundTo, release move) |
| same | :618-640 | NEW retired-holder case: retired row does not block, its key gives a new MIC (201), op 98 names only the live holder |
| same | :642-665 | NEW X-2 multi-holder case: with and without `release`, and towards a holder's own key -> 409 ALREADY_BOUND `MIC-01`; nothing written; op 98 `boundTo` = `MIC-01` |
| same | :857-862 | static: the three reads filter `retired_at IS NULL`; DB-A2 has no `IS NOT NULL`, ends `ORDER BY i.device_id`; REKEY SET list has no `device_id`/`sample_rate`/`retired_at` |
| .../audio-cards/__tests__/routes.db.test.ts | :561-570 | DB-A2 on PostgreSQL as dems_app: a NULL/NULL row is returned, op 98 `boundTo` MIC-04, op 99 input 2 -> 409 ALREADY_BOUND MIC-04 |
| same | :660-679 | T-12: session open, op 99 with `release: true` (two bodies) -> 409 CAPTURE_CONFIG_LOCKED, no row/audit/listing; MIC-04 still at input 1 |
| same | :683-705 | NEW T-11: two op 99 begun together on an unbound card -> statuses [201, 409], reason IN_PROGRESS or ALREADY_BOUND, 1 live row, 1 REGISTERED audit; a later call names the winner |
| same | :66, AD-07 block | DEVICE_TEXT and model list include the new fixture card |
| .../audio-cards/__tests__/fixtures.ts | :116-124 | `TRIO`, `TRIO_PORT`, `THREE_CARDS` |

T-8, T-9, T-10 were already on PostgreSQL from row 131 (`routes.db.test.ts` "T-7 / T-8", "T-9 / T-10"; T-10 asserts 1 live row and RELEASED(1) then REENABLED(2)); unchanged, still pass. X-1: no gate added (units serial, pipeline.ts:5-8, unit-of-work.ts:15-18).

## Tests (verbatim)
| Command | Result |
|---|---|
| `npm test -w @dems/core-server -- src/modules/capture-inputs/audio-cards/__tests__/service.test.ts src/modules/capture-config/__tests__/selector-reader-inventory.test.ts --maxWorkers=2` | Test Files 2 passed (2); Tests 47 passed (47) (no expected-fail left) |
| `lockf db-runner.lock npm run test:db -w @dems/core-server -- .../audio-cards/__tests__/routes.db.test.ts src/engine/__tests__/readdress-door.db.test.ts --maxWorkers=2` (outside sandbox) | Test Files 2 passed (2); Tests 30 passed (30) |
| `lockf heavy-host.lock npm run typecheck -w @dems/core-server` | exit 0 |
| `lockf db-runner.lock npm run test:db -w @dems/core-server -- .../e2e/first-full-session.db.test.ts` (comparison only, not owned) | Tests 1 failed, 2 passed, 4 skipped (7) - identical to row 131's run: row 89 boot-check case (`capture.boot` list), not audio |

## Decisions / deviations
- D-108-1 X-2 holder order: implemented tier = lowest MIC id (DB-A2 ORDER BY device_id), for op 98 `boundTo` and the op 99 refusal. The "slotted primary, then standby" tiers need the module to read the two mic slots of `capture_config`, which makes it a selector-row reader; `selector-reader-inventory.test.ts` I-1 is a closed list owned elsewhere. Filed in file_requests.md (blocking no; X-2 out of bench scope).
- D-108-2 X-2 replaces D-131-4: several holders + `release` -> 409 AUDIO_CARD_ALREADY_BOUND (first holder), no longer AUDIO_INPUT_NOT_REGISTRABLE. Checked after step 3 and before step 5; R-3 (target key held by a non-holder row) keeps AUDIO_INPUT_NOT_REGISTRABLE.
- D-108-3 D-A3.4 applied to READ_REGISTERED / READ_AUDIO_INPUT_OF_CARD (row 131 left it to rows 91/108): a retired row's key gives a new microphone instead of re-enabling (and failing on) the retired row.
