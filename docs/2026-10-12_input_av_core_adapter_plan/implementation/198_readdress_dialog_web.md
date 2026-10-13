---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 198
date: 2026-10-13
agent: coder-execution (wave 11, agent W1; single writer of apps/core-web)
tier: T3
status: complete
---

# Row 198 - web console: the confirmation dialog of a camera re-address (operation 100)

Builds on `implementation/194_readdress_contract.md` and `197_readdress_wiring.md` (its request line
"row 198 - information": the address form and the repeat answer).

## What was built

| File | Content |
|---|---|
| `apps/core-web/src/features/devices/camera-readdress.ts` (NEW) | `readdressOffer(candidate)` (pure), `foundAddressOf`, `readdressBodyOf`, `confirmDeviceAddress` (operation 100 in both data modes), `readdressRefusal`, `readdressMayRepeat`, `useRegisteredCameraAddress` |
| `apps/core-web/src/features/devices/camera-readdress-dialog.tsx` (NEW) | the kit's `AlertDialog` (`@heroui/react`): both addresses, the consequence, Cancel / "Store the found address", the refusal as an `Alert`, "Search again" |
| `apps/core-web/src/features/devices/camera-search-panel.tsx` | a REGISTERED row with an offer gains the control "Confirm new address" (disabled with the selector's reasons: role, open session); the panel mounts the dialog |
| `apps/core-web/src/i18n-web.ts` | group `web.readdress` |
| `apps/core-web/src/features/devices/__tests__/camera-search.test.tsx` | the case of row 98 restated (the row now OFFERS the confirmation); a new block of six cases |

## The cells of the row

| Cell | How it is kept | Test |
|---|---|---|
| offered when a search candidate matches a registered camera at another address | `status REGISTERED`, `addressChanged`, a `CAM-nn` id, not a conflict row, an address of the contract's form | "the offer" |
| states the registered and the found address | registered: `host` of the device in `captureDevices`; found: `host`, or `host:port` for a port that is not the scheme's default (the Core's `adoptionAddressOf`, read from `connectionTarget`) | "the dialog" |
| sends the request only after the operator's explicit answer | ONE call site of `confirmDeviceAddress`: the press of the confirming button. Opening and Cancel send nothing. The kit's alert dialog is not closed by Escape or an outside press | "the dialog" (0 requests after open, Cancel, Escape; 1 after the press, with body `{ deviceId, candidateId, address }`) |
| every refusal with its sentence | table below; never the answer's text; nothing is retried by itself | "every refusal" (13 answers), "SIMULATOR-ONLY" |

## Refusals

| Answer | Sentence |
|---|---|
| `409 INVALID_STATE` + one of the six `CaptureReaddressReason` | the contract's own (`CAPTURE_READDRESS_REFUSAL_SENTENCES`) + "Nothing was changed." |
| `422` + `DISCOVERY_ADDRESS_NOT_ALLOWED` | `CAPTURE_READDRESS_ADDRESS_NOT_ALLOWED_SENTENCE` + "Nothing was changed." |
| `409 CAPTURE_CONFIG_LOCKED` | The address of a camera cannot be changed while a session is open. Nothing was changed. |
| `404` | The Core no longer keeps this camera or this search result. Search again. Nothing was changed. |
| `503` + `DISCOVERY_NOT_READY` | The camera search of this Core is not available now. Nothing was changed. |
| `403` | Your role may not change the address of a camera. Nothing was changed. |
| another `422` | The confirmation was not accepted as it was written. Search again. Nothing was changed. |
| anything else | the shared presenter, then: The Core did not confirm the change. Search again to read the address it holds for this camera. |

After a refusal that concerns the candidate the confirming button is replaced by "Search again"; only
the lock, a search that is not ready and an unanswered request leave the same confirmation.

## Simulator-only answer

The in-app simulator's cameras never move: it answers `409 READDRESS_NOT_THE_REGISTERED_CAMERA`
(or `404`). The 200 and the other refusals of the tests are contract-shaped answers handed in in
place of the simulator's; the test file says so above the block.

## Checks

| Command (from `apps/core-web`) | Result |
|---|---|
| `npx vitest run src/features/devices/__tests__/camera-search.test.tsx --maxWorkers=2` | first run: 1 failed of 22 (my new case expected Escape to close the kit's alert dialog - it does not, by the kit's default); second run `Test Files 1 passed (1)`, `Tests 22 passed (22)` |

## Driver decisions

| # | Decision | Why |
|---|---|---|
| DD-1 | The kit's defaults of `AlertDialog` are kept: no close on Escape or an outside press | an alert dialog asks for one of its two answers; a dismissal is Cancel |
| DD-2 | The dialog opens on the row as drawn, without a second read of operation 94 | the Core compares the confirmed address with its own search state (`READDRESS_CONFIRMATION_MISMATCH`) |
| DD-3 | After a 200 the list is read again, not searched again | record 197: the candidate still reads `addressChanged` until the next search; a second confirmation answers `READDRESS_ADDRESS_UNCHANGED`, which has its sentence |
| DD-4 | The offer is gated like "Connect" (`connectBlock`) | the same permission (`CAPTURE_CONFIG`) and the same idle lock |

## Unproven

A 200 of a real Core (needs the composition's `provideNetworkFacts` statement, request of row 197, and
a production Core): it goes to the hardware package (the records this row read name no check id for a
confirmed re-address - the controller assigns one). A candidate without `connectionTarget` whose service address names a
port confirms `host` alone and is answered `READDRESS_CONFIRMATION_MISMATCH` (its sentence).
