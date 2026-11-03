---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
row: 88 (decision D48, mic per input)
date: 2026-10-23
agent: coder-execution
source_plan: controller brief (D48, 2026-10-23); no plan row
status: complete
---

# Implementation Report: one DEMS microphone per INPUT of a sound card (D48)

## Executed Steps
| Step | Task | Status | Notes |
|---|---|---|---|
| 1 | Read code_wave_rules.md, map every one-microphone-per-card check | done | server op 99 (`service.ts`), web `inputOffered` + move control; plan/worker side has none (see Verification) |
| 2 | Scope the op-99 binding rule to (card identity, card device, input number) | done | `service.ts` |
| 3 | Web: offer every input of a bound card; drop the move control | done | `audio-cards.ts`, `audio-cards-panel.tsx`, i18n refusal text |
| 4 | Update tests pinning the old rule; add D48 cases | done | unit + web run; db/acceptance edited, NOT run |
| 5 | Unit tests, typecheck, lint | done | numbers below |

## Changes Made
| File | Change Type | Description |
|---|---|---|
| apps/core-server/src/modules/capture-inputs/audio-cards/service.ts | modify | Header 42-67: rule text D48. 226: refusal message "Another microphone holds this input of the sound card." 309-313: `boundTo` = first holder (lowest MIC id). 566-575: new `blocks` predicate - a live holder blocks only when it holds the SAME (cardDevice, inputNumber), or when its match is not SAME_CARD (NOT_TELLABLE twins stay held whole). 603-613: comments (port move / release / X-2 now per input). Port move, `release: true` move, `inputTaken`, X-2 code paths unchanged. |
| apps/core-server/src/capture-composition.ts | modify | Comment 42-45 only (op 99 refuses a second microphone on an input that has one). |
| apps/core-server/src/modules/capture-inputs/audio-cards/__tests__/service.test.ts | modify | 401-470: D48 tests replace "second input refused / release moves" (second input -> 201 MIC-04; same input again 200 REENABLED with and without release; op 98 lists both inputs); same-input refusal + release move on a NOT_TELLABLE twin; rollback test moved to the twin case. 557: macOS-moved card, another input -> 201. 586-589: twins, another input of either unit still refused. 637-651: DB-A2 portless, other inputs -> 201. 661-667: retired-holder case. 675-707: X-2 rescoped (different inputs -> 201; two live rows on the same input -> 409 naming the first). |
| apps/core-server/src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts | modify | 535-563: T-9/T-10 -> D48 (201 MIC-06 on input 2, REENABLED with release, op 98 both inputs). 569-583: follow-on test expects MIC-06 in DB-A2 read and 200 REENABLED for input 2. 688-689: comment. 696-722: T-11 -> two inputs begun together each 201 or 409 IN_PROGRESS, never ALREADY_BOUND. NOT RUN (db project). |
| apps/core-server/test/acceptance/contract.test.ts | modify | Removed the 409 ALREADY_BOUND / release-move block; after the registry read (so AC-B-70 still sees exactly one registered microphone there) added 1231-1243: input 4 -> 201 second microphone, again with release -> 200 REENABLED, listing names both. NOT RUN (db project). |
| apps/core-web/src/features/devices/audio-cards.ts | modify | Header 22-28; `withRegistration` 187-200 keeps the first holder in `boundTo`; `inputOffered` 222-229 offers every input unless ambiguous. |
| apps/core-web/src/features/devices/audio-cards-panel.tsx | modify | Removed `MoveRight` import, the move control (button, hint, cancel) and the `onMove`/`onCancelMove` props; doc comment 40-44. |
| apps/core-web/src/features/devices/__tests__/audio-cards.test.tsx | modify | Pins: every input of a bound card enabled, no move control, second input -> 201 with no `release`, chip keeps first holder; new refusal text. |
| packages/shared/src/i18n/en/common.ts | modify | 1082: `AUDIO_CARD_ALREADY_BOUND` sentence now names the input and no longer says "move ... to another input". |

## Test Results
| Test Type | Command | Result | Notes |
|---|---|---|---|
| core-server unit | `flock .data/locks/heavy-host.lock npm test -w @dems/core-server -- src/modules/capture-inputs/audio-cards/__tests__/service.test.ts --maxWorkers=2` | `Test Files 1 passed (1)`, `Tests 36 passed (36)` | first run green |
| core-server unit (related + static) | same, with `src/modules/capture-config/__tests__/selector-reader-inventory.test.ts src/__tests__/capture-composition.test.ts src/capture/adapters/audio/__tests__/usb-audio-production.test.ts test/static` | `Test Files 21 passed (21)`, `Tests 400 passed / 1 skipped (401)` | |
| core-web | `npx vitest run src/features/devices/__tests__/audio-cards.test.tsx --maxWorkers=2` | `Test Files 1 passed (1)`, `Tests 14 passed (14)` | |
| typecheck core-server | `NODE_OPTIONS=--max-old-space-size=6144 flock ... npm run typecheck -w @dems/core-server` | exit 0 | without NODE_OPTIONS tsc aborts with "JavaScript heap out of memory" at ~2 GB (host/heap, not a type error); tsconfig includes `test/` and the db test files |
| typecheck shared | `npm run typecheck -w @dems/shared` | exit 0 | |
| typecheck core-web | `npm run typecheck -w @dems/core-web` | exit 0 | `tsc -b` |
| lint | `npx oxlint` on the changed files | web 0/0; server 1 warning, 0 errors | the warning (`enabledUsb` unused, routes.db.test.ts:452) exists at HEAD |
| db / acceptance | not run | - | forbidden on this host (production DB on 127.0.0.1:4432) |

## Verification
- Second input of a held card registers: service.test.ts "D48: a second input of a held card is a SECOND microphone" (MIC-03 input 1, MIC-04 input 2, 201) - passed.
- Same input twice is not a second microphone / is refused when held elsewhere: same test (200 REENABLED, `releasedDeviceId: null`) and "D48: the same input held under another key is refused 409 AUDIO_CARD_ALREADY_BOUND ... with release: true the holder of that input MOVES" - passed.
- NOT_TELLABLE kept: AU-R3 test now also refuses another input of either twin - passed.
- Plan/worker side has no one-microphone-per-card check: `allocateCardInput` (card-listing.ts:693-705) refuses only INPUT_TAKEN / RATE_DIFFERS; `usb-audio-production.ts:630-635` dedupes shared-capture entries per card:device before `ensureAlsaConfig` (so alsa-config's DUPLICATE refusal is not hit by two inputs); `packages/shared/src/sim/capture-config.ts` only requires two different devices; DB unique key is `(card_id, card_device, input_number) WHERE retired_at IS NULL` (migration 0032 line 7) - no card-level uniqueness.

## Persistent Issues
| Issue | Attempts | Root Cause | Current Status | Blocking? |
|---|---|---|---|---|
| db tests and acceptance contract edited but not run | 0 | test:db uses 127.0.0.1:4432 = production DB of this host | open; needs a db-capable host | no for the bench, yes before merge |
| core-server typecheck OOM at default heap | 1 | tsc needs > 2 GB heap | passes with `--max-old-space-size=6144` | no |

## Issues & Decisions
| Step | Issue / Decision | Resolution |
|---|---|---|
| 2 | `release: true` on a FREE input of a held card no longer moves the holder (brief: release concerns the holder of the SAME input) | it registers a new microphone; `releasedDeviceId` null |
| 2 | NOT_TELLABLE twins: kept card-level (a holder whose match is not SAME_CARD blocks every input of both units) | as brief ("keep NOT_TELLABLE behaviour") |
| 2 | `boundTo` (single field) now = first holder (lowest MIC id); `registered[]` carries every input | contract shape unchanged |
| 3 | Web move control ("Move MIC-nn to another input") removed: under D48 it would register a new microphone, not move | i18n keys `release`, `releaseHint`, `released` left in the catalogue (unused by the panel except `released`) |
| - | Not changed: the contract descriptions in `packages/shared/src/api/capture-audio-cards.ts` (lines ~115-118, 171, 199, 318-334, 469) still say "a sound card is held by one microphone"; they feed `openapi.json` (generated, pinned, has uncommitted edits) | needs a generator-row change |

## Next Steps
- Run `routes.db.test.ts` and `test/acceptance/contract.test.ts` on a host with a non-production DB.
- Update contract description text + regenerate openapi.json (separate row).
- Review recommended (scope: service.ts `blocks` predicate, web move-control removal).
