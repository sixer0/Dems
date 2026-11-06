---
task: 2026-10-12_input_av_core_adapter_plan
row: 98
milestone: M8 / WP-12
agent: coder-execution (batch 8, agent U)
date: 2026-10-13
tier: T3
status: needs-review - the typed address is built and tested in full; the confirmation of a re-address is NOT built, because the contract has no operation to send (it waits for the operation row 97 asked for)
---

# Row 98 - web console: the typed address on the search, the confirmation of a re-address

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `WEB` = `apps/core-web/src/features/devices`, `SH` = `packages/shared`.

## 1. What was built: the typed address (operation 93, optional `address`)

| File | State | Change |
|---|---|---|
| `WEB/camera-search.ts` | MOD | `typedAddressOf(text)` (the form rule: the contract's `CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN` and its 15 characters, after trimming blanks); `startSearch(gate, address)` sends the body `{ address }` only when an address is given and NO body otherwise (as before); `start(address?)` of the controller, which holds the form rule a second time; the refusal name `ADDRESS_NOT_ALLOWED` (`422` with `DISCOVERY_ADDRESS_NOT_ALLOWED`) |
| `WEB/camera-search-address.tsx` | NEW | `CameraSearchAddress`: the form "A camera that does not answer the search" (kit `TextField` / `Label` / `Input` / `FieldError` / `Description`, `Button`) |
| `WEB/camera-search-panel.tsx` | MOD | one import, one line: the form under the body of the panel, not drawn while the role is being checked |
| `WEB/__tests__/camera-search.test.tsx` | MOD | one `describe` added (6 cases), one import, two header lines; no existing case edited |
| `SH/src/i18n/en/common.ts` | MOD | NEW group `common.captureSearch.typedAddress` (9 strings) |

Behaviour, each with its case in the block "the typed address" of `camera-search.test.tsx`:

| Rule (contract `implementation/094_typed_address_contract.md`) | Screen | Case |
|---|---|---|
| The form: ONE dotted IPv4 literal | `typedAddressOf`: 4 accepted texts, 19 refused (a name, a port, a prefix, a link, IPv6 texts, a number out of range, a leading zero, two addresses, non-ASCII digits, hexadecimal and integer forms) | case 1 |
| An address outside the form is refused IN THE FORM | the field is marked invalid with the sentence `form`; 0 requests of operation 93, 0 audit rows, the list unchanged; typing again removes the refusal | case 2 (five texts) |
| An address of the form is sent as the one member | body exactly `{ address: '192.168.10.20' }`; what answered is a row of the same list with the same Connect | case 2 |
| A search without the member is as before | "Search for cameras" / "Search again" send no body (asserted `undefined`); the 14 other test files of the feature pass unedited | case 2 |
| `422 DISCOVERY_ADDRESS_NOT_ALLOWED` | the sentence `notAllowed` beside the field; no panel notice, no toast, the list unchanged | case 3 (the simulator's stand-in of the rule refuses `8.8.8.8`) |
| No probe while the caller's own search runs | while the panel is SEARCHING the control is disabled with `searching` and a press or a submit sends nothing; a `200` with `created: false` is said with `notProbed`, never drawn as a search of the address | case 4 |
| Role | the same gate as "Search for cameras" (G13: role, recording, spacing): the field and the control are disabled with the role sentence, never hidden; nothing sent | case 5 |
| Web console only | the member is sent by this client only (the web console); a `403` goes to the shared refusal presenter as every 403 of the search does | - (cannot arise from this client) |

Verification cell, first half ("an address outside the allowed form is refused in the form"): case 2.

## 2. What was NOT built: the confirmation of a re-address

`implementation/097_confirmed_readdress.md`: the server part is a service behind seams with no route, because the contract holds no operation for a re-address (99 operations; none takes a new address for a registered device). A dialog whose confirming press has nothing to send would be an invented control, so none was built.

| Part | State | Waits for |
|---|---|---|
| The fact "this registered camera now answers from another address" | EXISTS (operation 94, member `addressChanged`; sentence `common.captureSearch.addressChanged`) and is now tested: the row says it, offers "View device" only, no dialog exists, the registry entry is unchanged, and the only request is the search | - |
| The confirmation dialog and its request | NOT BUILT | the contract operation row 97 proposed: `confirmCaptureDeviceAddress`, POST `/api/v1/capture/devices/{id}/address`, body `{ candidateId, address }`, with its refusal reasons and access rule (row 97 requests 1 to 3 in `file_requests.md`); then one web row adds an `AlertDialog` on the REGISTERED row and the string group `common.captureSearch.readdress` (a line of row 98 in `file_requests.md`) |

Verification cell, second half ("the confirmation dialog must be answered before the request is sent"): NOT closed. What holds today is stronger and is tested (case 6): no request can be sent at all.

## 3. Checks (2026-10-13)

| Check | Command | Result |
|---|---|---|
| The feature's test files, one run | `npx vitest run --maxWorkers=2 src/features/devices/__tests__` in `apps/core-web` | `Test Files 15 passed (15)`, `Tests 181 passed (181)` |
| Other page tests that mount Devices & Inputs (collateral of both rows), one run | the same on `src/test/live-devices-commands`, `live-d2-client-seams`, `live-w0-camera-words`, `selector-in-force`, `live-devices-clip`, `live-devices-drawer`, `live-w0-page-logs`, `dev-console-logging`, `real-core-facts` | `Test Files 9 passed (9)`, `Tests 181 passed (181)` |
| i18n of the shared package | `npx vitest run --maxWorkers=2 test/i18n.test.ts test/i18n-vocabulary-sync.test.ts` in `packages/shared` | `Test Files 2 passed (2)`, `Tests 52 passed (52)` |
| Typecheck (the workspace touched and every importer of `packages/shared`) | `npm run -s typecheck` in `packages/shared`, `apps/core-web`, `apps/core-server`, `apps/mobile`, `apps/mock-core` | exit 0, five of five |
| Lint | `npx oxlint src/features/devices` in `apps/core-web` | exit 0 |

NOT run: `npm test`, any full suite, Vite, a browser, an emulator.

## 4. i18n served in this row (single writer of `common.ts` in batch 8)

| Request | Served |
|---|---|
| Row 38 (`file_requests.md` line 6): the two `NOT_H264` strings | `outcome.NOT_H264`: the proposed sentence ("... delivers H.264 or HEVC ..."). `outcomeShort.NOT_H264`: "Neither H.264 nor HEVC" (DD-3) |
| Row 63 (line 37): wording of `AUDIO_INPUT_NOT_REGISTRABLE`, `AUDIO_INPUT_BEYOND_CARD` | in `common.captureAudioCards.refusal` (row 72) |
| Agents T2, G, K | none asked (the file was read once before finishing, 09:05 WIB) |

`common.ts` against the commit: 66 insertions, 2 deletions, all of rows 72 and 98. No i18n count pin moved: none counts the leaves (`i18n.test.ts:127` is relative).

## 5. The double, and what stays unproven

The double is the in-app simulator (its typed-address candidate and its stand-in of the destination rule); the `200` with `created: false` is put in at `sim.request`. Unproven: the Live transport (`live.client.call('startCaptureDiscovery', { body: { address } })` compiles against the typed client; no test of this row runs it against a Core); the Core's probe and its refusals with 0 packets (row 96, in flight in this batch); a real camera that answers a unicast probe (`9A/H-12`).

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | No confirmation dialog was built | no existing operation supports it; a control that sends nothing would be invented. Row status `needs-review` for this reason only |
| DD-2 | Blanks around the typed text are not part of the address (`' 192.168.10.20 '` is sent as `192.168.10.20`) | a pasted address; the literal sent still passes the contract's pattern exactly |
| DD-3 | `outcomeShort.NOT_H264` reads "Neither H.264 nor HEVC", not the "No usable profile" row 38 proposed | "No usable profile" is the short label of `WRONG_PROFILE` in the same map; two outcomes would read alike |
| DD-4 | The form is always drawn in the panel once the role is resolved (also in the idle and the empty state), disabled with its reason when the search control is | "the explicit fallback": a gated control is disabled with its reason, never hidden |
| DD-5 | The refusal of the address is worded in the form, not as a notice of the panel; the typed text is kept after an answer | it is about the field; the list and its notices are the previous search's |
| DD-6 | The sentence of the refusal says the Core "asks only addresses on the network the cameras are connected to" and names no interface or range | the contract carries one reason for every refusal of the rule and never the rule's own code (094, decision 2) |

## 7. Requirements

AM-3 / U12 A7 (web half: one typed address, an explicit fallback, a candidate like any other): closed on the simulator. S13-11 point 1, form half (client): the form is no looser than the contract's pattern (it IS that pattern). C10 (the member is web console only): this client is the only sender. NEW-1 "a changed camera address is never followed automatically" (web half): tested, case 6. WP-12 second half (the confirmation): open, see section 2.

---
*Generated: 2026-10-13*
