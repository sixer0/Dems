---
task: 2026-10-12_input_av_core_adapter_plan
row: 156
milestone: M4 / AD-07 (3), (4)
agent: coder-execution (batch 7, agent R/T/X)
date: 2026-10-13
tier: T3
status: needs-review - the identity rule is built and proven on a store that holds the port; the table has no port column, so in the product the port of a stored input cannot be compared yet (one request)
---

# Row 156 - the card search single-flight and spaced like the camera search; the match of a stored input to a live card by USB id and port path

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `AC` = `apps/core-server/src/modules/capture-inputs/audio-cards`.

## 1. What was there (row 70) and what the camera search does

| Point | Camera search (`modules/capture-discovery/limits.ts`, `search.ts`) | Card search before this row (`AC/service.ts`, `createListingGate`) |
|---|---|---|
| single flight | one RUNNING search per Core | one listing per Core; a second call is `409 AUDIO_CARD_SEARCH_IN_PROGRESS` and reads no host |
| per Core, between starts | 5 s (`CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS`) | 5 s (the same constant through `CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS`) |
| per Core, per minute | 6 starts (`CAPTURE_DISCOVERY_MAX_PER_MINUTE`) | none |
| per operator session | 10 s between starts; 30 starts an hour | none |
| a refused call | counts nothing | counts nothing |
| the match of a stored input | - | by the exact key (card id, device index, input number), then the USB id; no port |

## 2. Change set

| File | Change |
|---|---|
| `AC/service.ts` | `createListingGate`: the per-Core bound per minute (third parameter, default `CAPTURE_DISCOVERY_MAX_PER_MINUTE`) beside the spacing; a clock that went back locks nothing out. NEW `matchStoredCard` and the closed set `StoredCardMatch` (`SAME_CARD`, `USB_ID_DIFFERS`, `PORT_DIFFERS`, `NOT_TELLABLE`). `registerAudioInput` decides REENABLED / CARD_CHANGED by that rule, hands the listing's port to the store, and notes the match as a CODE. `ListedAudioCard` gains the optional `usbPort` the enumerator of row 64 already supplies |
| `AC/store.ts` | interface only: optional `usbPort` of `StoredAudioInput` and of `AudioInputFacts`. The statements and `createMicrophoneStore` are NOT changed: the table has no port column, the store answers none |
| `AC/__tests__/fixtures.ts` | five host texts that differ in the port path only (same product on another port; no port stated; two cards of one product; the two with their ports exchanged) |
| `AC/__tests__/service.test.ts` | the store double holds the port (`storesPort: false` = the product's store of today); +7 cases |
| `AC/__tests__/routes.db.test.ts` | the step of the gate's own clock is `GATE_STEP_MS` (10 s: past both bounds); the spacing case takes the clock back by the same arithmetic. No expectation changed |

## 3. The identity rule (`matchStoredCard`)

A stored input is found by its exact key. The card behind that key is then:

| Stored against live | Answer | Registration says |
|---|---|---|
| another USB id | `USB_ID_DIFFERS` | CARD_CHANGED |
| the USB id, both ports stated, ports differ | `PORT_DIFFERS` | CARD_CHANGED |
| the USB id, both ports stated, ports equal | `SAME_CARD` | REENABLED |
| the USB id, a port missing on one side, no other card of that USB id on the host | `SAME_CARD` | REENABLED |
| the USB id, a port missing on one side, ANOTHER card of that USB id on the host | `NOT_TELLABLE` | CARD_CHANGED |
| no USB id on either side (not a USB card) | `SAME_CARD` | REENABLED |

Never the product text; never the card id alone (the kernel derives it from the product). CARD_CHANGED is one `CAPTURE_AUDIO_INPUT_CHANGED` entry with its six closed keys; the stored facts then follow the live card, so the change is said once. No port, USB id or product is in an audit detail, a log note or a refusal.

## 4. Checks (2026-10-13)

| Check | Result |
|---|---|
| `vitest run --project unit src/modules/capture-inputs --maxWorkers=2` | first run of the audio-cards file: 19 of 20, the failure in MY new case (it listed five detail keys; the entry has six, with `operationId`). Second run: `Test Files 2 passed (2)`, `Tests 31 passed (31)` |
| database, sandbox off, `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock`, throw-away databases: `vitest run --project db --maxWorkers=2` on `AC/__tests__/routes.db.test.ts`, `test/acceptance/contract.test.ts`, `test/acceptance/rbac-matrix.test.ts` (the two acceptance files because the gate's default changed) | `Test Files 3 passed (3)`, `Tests 95 passed (95)`; `dropped 3 database(s) ...; 0 remain` |
| `npx tsc --noEmit` in `apps/core-server` | exit 0 |
| `npx oxlint src/modules/capture-inputs` | exit 0 |

Verification cell:
- "two concurrent searches start 1 process": case "concurrent searches start ONE process" - of two and of five begun in the same turn, the host is read once, the others answer 409; the database case "409 ... while a listing runs" holds the same on the routes.
- "a card of the same product on another port is `CARD_CHANGED` with 1 audit entry and no silent match": case "a card of the same product on ANOTHER PORT ..." (real enumerator; the two host texts differ in the port only; one entry, one device, match code `PORT_DIFFERS`, no device text written) and the case of two cards whose ports were exchanged.
- spacing: case "spaced like the camera search per Core" (six searches 5 s apart, the seventh 429 with `retryInMs: 30000`, let through at the minute; a refusal counts nothing; a registration is not counted).

## 5. The double, and what stays unproven

Doubles: the real enumerator of row 64 over fixed host texts; a store double that holds the port beside the rows. Real on PostgreSQL: the routes and the unchanged statements.

Unproven or open:
1. IN THE PRODUCT the store holds no port (no column). There a card of the same product on another port, alone on the host, is still re-enabled silently - measured and marked STATED GAP in `service.test.ts`. With two such cards on the host the rule says NOT_TELLABLE (CARD_CHANGED). Closing it is the request below.
2. The port text of a real host and identity after a re-plug: `9A/H-07` steps .5, .6, .8.
3. Operations 98 and 99 still answer 503 on every Core (no enumerator handed in, no registrar: rows 85 and the engine's microphone action, row 70's requests).

## 6. Identifiers

AD-07 (3): closed for the two per-Core bounds and single flight. AD-07 (4): the rule is built and proven on doubles; NOT closed in the product until the port is stored.

## 7. Requests (file_requests.md, two lines of row 156)

1. The column `capture_audio_inputs.usb_port` (migration writer) and, after it, two statements and two lines of this module's store.
2. For a ruling: the camera search's two per-session bounds are not applied to the card search; a registration lists unspaced and uncounted.

## 8. Driver decisions (for the controller to confirm)

- DD-1: the per-Core bound per minute is added with the camera search's constant; the per-session bounds are not (no session id at the service; the contract states one per-Core spacing).
- DD-2: `NOT_TELLABLE` (no port to compare and a second card of the USB id on the host) is said as CARD_CHANGED rather than matched. It over-reports for an operator who has two identical interfaces attached, until the column exists; under-reporting was the alternative.
- DD-3: the stored facts follow the live card after a CARD_CHANGED (as row 70 did for the USB id): said once, then the new card is the registered one.
- DD-4: no statement was written against a column that does not exist; the port travels through the store's interface only.
- DD-5: the rule lives in `AC/service.ts` (the module imports nothing of `capture/adapters`, static rule A-5); the adapter's own match at `open` (row 67) is not this row's.
