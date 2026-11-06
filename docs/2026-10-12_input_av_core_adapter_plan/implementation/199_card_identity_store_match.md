---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 199 (M4 / WP-07c; follow-up of row 192; findings of rows 67 and 156; requirement AD-07 (4))
date: 2026-10-13
agent: coder-execution (batch 9, agent R4)
tier: T3
status: complete on doubles - needs-review for four driver decisions (section 6) and one contract request (section 7)
branch: task4/input-av-core-port (nothing committed, nothing staged)
---

# Row 199 - the registration stores the serial and the port path of a sound card; a stored input matches a live card by serial, else by port path

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `AC` = `CS/src/modules/capture-inputs/audio-cards`, `AU` = `CS/src/capture/adapters/audio`.

## 1. Why

input-av's handover recorded a sound card silently swapped for another. Until this row the Core matched a stored input to a listed card by USB vendor:product only: every unit of a product carries the same USB id, so a same-model card on another port matched silently (`implementation/156_card_search_match.md` section 5 item 1, marked STATED GAP; `implementation/067_usb_audio_adapter.md`). Schema set B (commit `b60a9fa3`) added `capture_audio_inputs.usb_serial` and `usb_port`; nothing wrote or read them (`implementation/192_audio_input_serial_port.md` section 4).

## 2. What was built

| File | State | Change |
|---|---|---|
| `AU/card-listing.ts` | MOD | kind `USB_SERIAL` of `CardStringKind` with its rule (letters, digits and `: . _ -`, 1 to 64 - the CHECK of the column; else nothing, never a cleaned or cut text); member `usbSerial` of `CardUsbIdentity` and `CaptureCard`, each named in `CARD_LISTING_STRING_FIELDS` (it does not compile otherwise); `parseUsbIdentity` takes the serial text as a third argument; OPTIONAL member `usbSerial(cardIndex)` of `CardListingSource`, asked once per USB card |
| `AU/card-listing-reader.ts` | MOD | ONE more file, for reading only: `<devices>/card<N>/device/../serial`, `devices` = `/sys/class/sound` (`CARD_DEVICES_ROOT`), `N` the card INDEX held to 0..31. Absent = null. Third parameter `devicesRoot` for a test |
| `AC/statements.ts` | MOD | `usb_serial`, `usb_port` in `READ_REGISTERED_AUDIO_INPUTS`, `READ_AUDIO_INPUT_OF_CARD`, `INSERT_AUDIO_INPUT` (11 placeholders), `REFRESH_AUDIO_INPUT` (8) |
| `AC/store.ts` | MOD | `cardIdentityValuesOf` = `[usbId, serial, port]` (the hook of row 190); `cardIdentityText`: a value outside the closed form is BOUND and READ as NULL; `StoredCardIdentity`; `inputOf` and `registeredInputs` answer the identity |
| `AC/service.ts` | MOD | `matchStoredCard` by the rule of section 3; two new answers `SERIAL_DIFFERS`, `IDENTITY_NOT_STORED`; operation 98 lists a stored input under a card only when that card IS the stored one; operation 99: a non-match is `CARD_CHANGED` WITHOUT the registrar's re-enable; a USB card with neither serial nor port is refused |
| `AU/__tests__/card-listing.test.ts`, `card-listing-reader.test.ts` | MOD | +3 and +1 cases; `usbSerial: null` added to five exact card expectations; the kind tables and the rule-use pin gain `USB_SERIAL` |
| `AU/__tests__/alsa-config.test.ts` | MOD | ONE line (`usbSerial: null` in a typed card literal; declared after the fact) |
| `AC/__tests__/fixtures.ts` | MOD | `serials` of a host; 9 host texts (a unit with a serial, moved, another unit on the same and on another socket, two that share a serial, the two-card host with one serial) |
| `AC/__tests__/service.test.ts` | MOD | the store double holds serial and port; +7 cases; 2 cases of row 156 turned (section 5) |
| `AC/__tests__/routes.db.test.ts` | MOD | +5 cases on PostgreSQL (block `row199Cases`, run after the admission block whose commit count it would move); one read-back line in the 201 case; the device-text list gains the serial and the three port paths |

Nothing of `packages/shared`, `db/**`, `capture/fence/**`, the static-rule lists, `registrar.ts`, `index.ts`, `routes.ts` was edited. Edit tool only for every existing file.

## 3. The identity rule (`matchStoredCard`, `AC/service.ts`)

A stored input is found by its exact key (card id, device index, input number). The card behind the key is then:

| Stored against live | Answer | Operation 99 says |
|---|---|---|
| another USB id | `USB_ID_DIFFERS` | CARD_CHANGED |
| no USB id on either side (not a USB card) | `SAME_CARD` | REENABLED |
| stored: no serial AND no port (a row of before schema set B) | `IDENTITY_NOT_STORED` | CARD_CHANGED |
| a serial stored, the live card states the same - on ANY port | `SAME_CARD` | REENABLED (the stored port follows) |
| ... and another live card of the USB id states that serial too | `SAME_CARD` only on the stored port, else `NOT_TELLABLE` | REENABLED / CARD_CHANGED |
| a serial stored, the live card states another, or none | `SERIAL_DIFFERS` | CARD_CHANGED |
| no serial stored, the live card states one | `SERIAL_DIFFERS` | CARD_CHANGED |
| no serial on either side, ports equal | `SAME_CARD` | REENABLED |
| no serial on either side, ports differ, or the live card states no port | `PORT_DIFFERS` | CARD_CHANGED |

Never the product text; never the card id or the USB id alone. No serial, port, USB id or product is in an audit detail, a log note (the match is logged as a CODE) or a refusal.

What CARD_CHANGED does since this row: ONE `CAPTURE_AUDIO_INPUT_CHANGED` entry; the registrar's re-enable is NOT called (0 re-enabled rows; `capture_devices` is not written); the stored identity then names the card the technician registered in that call (the contract: "now names that card"), so the same call again is a plain REENABLED. Operation 98 lists the card with `registered: []` before that: it is offered as a new card.

## 4. The cases the cells left open - decided

| Case | Decision | What the operator sees |
|---|---|---|
| A card states a serial today, had none when registered | NOT a match (`SERIAL_DIFFERS`), also on the same port: the registered card stated none, so this is not known to be it | the card with no registered input in the search; `CARD_CHANGED` on registering; after that call the serial is stored |
| A serial was stored, the card states none today | NOT a match (`SERIAL_DIFFERS`): the stored serial cannot be confirmed | the same |
| A hub renumbers its ports after a reboot | The stored form is the kernel's TOPOLOGICAL path of the stream file (`usb-<controller address>-<port chain>`, e.g. `0000:00:14.0-3.1`), not the bus/device number (counted up at every plug). A card WITH a serial is found on any port. A card WITHOUT one whose path changed is `PORT_DIFFERS`: one registration by the technician | `CARD_CHANGED` once per input, then the new path is the stored one |
| An input registered before the columns existed (both NULL) | REFUSED as a match (`IDENTITY_NOT_STORED`), not matched by USB id with a warning: the USB id alone cannot exclude another unit | the card as new in the search; `CARD_CHANGED`, the microphone not enabled again; the call stores the identity; the next call is REENABLED |
| A USB card that states neither serial nor port | not registrable: `409 INVALID_STATE` / `AUDIO_INPUT_NOT_REGISTRABLE`, nothing stored (its row could match no later listing) | the fixed refusal text |
| Two units without a serial exchanged ON THE SAME SOCKET | NOT DETECTABLE: USB id and port path are equal. Stated, not closed | nothing |

## 5. Verification cell, and the cases of row 156

| Cell | Case | Result |
|---|---|---|
| on a clone database a registration writes both values and reads them back | `routes.db.test.ts` "a registration WRITES both values and they READ BACK, as dems_app" (MIC-05 serial + port; MIC-04 NULL + port; `inputOf` and `registeredInputs` on the runtime pool) | green |
| a card without a serial on its stored port matches | db "A CARD WITHOUT A SERIAL ON ITS STORED PORT matches"; unit "WITHOUT a serial, on its stored port" | green |
| the stored serial on another port matches | db "THE STORED SERIAL ON ANOTHER PORT matches" (the stored port follows); unit the same | green |
| a same-product card with no matching serial on another port is `CARD_CHANGED` with 1 audit entry and 0 re-enabled rows | db "A SAME-PRODUCT CARD WITH NO MATCHING SERIAL ON ANOTHER PORT" (1 entry; `enabled` stays false; the count of enabled USB microphones unchanged; no second device); unit: six swaps in one loop, each 1 entry and `reenables = []` | green |
| the cases of row 156 show 0 other changed results | section below | 5 cases unchanged, 2 turned by design |

Row 156's seven cases in `service.test.ts`: "another port is CARD_CHANGED", "CONTROL: same port", "the second card under its own key", the three gate cases - UNCHANGED results (the first gained two lines: the re-enable is not called). TURNED, each named in the file:
1. "where NO port is on one side ..." -> "where NO identity is stored ...": `SAME_CARD` by the USB id became `IDENTITY_NOT_STORED` (this IS the stated gap being closed); a live card without a port after a stored one became a refusal.
2. the rule table: 12 rows -> 29; 7 rows answer as before, 4 "no stored port" rows turned to `IDENTITY_NOT_STORED`, 1 "no live port" row turned to `PORT_DIFFERS`.

Result lines (2026-10-13, from `CS`):

| Check | Result |
|---|---|
| `npx vitest run --project unit --maxWorkers=2 AU/__tests__/card-listing.test.ts card-listing-reader.test.ts alsa-config.test.ts src/modules/capture-inputs` | `Tests 9 failed \| 136 passed (145)`: all 9 in `src/modules/capture-inputs/__tests__/routes.test.ts`, `ReferenceError: registerAdoptedCameraTest is not defined` at `src/modules/capture-discovery/index.ts:298` (row 146 mid-edit; gone in the next run). My four files: green. One run |
| database, sandbox off, `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 AC/__tests__/routes.db.test.ts` | `Test Files 1 passed (1)`, `Tests 22 passed (22)`; `dropped 2 database(s) ...; 0 remain`. One run |
| `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static src/modules/capture-inputs` | `Tests 1 failed \| 302 passed (303)`: the red is `adapters/__tests__/static.test.ts:545` (A-10 (b)) naming `src/modules/capture-discovery/adopted-test.ts` - row 146's file, not this row's. The reader rule (one open, for reading), SR-4, A-5, SEC35-41 (c): green |
| `npx tsc --noEmit` | 1 error, `src/capture/__tests__/supervisor.test.ts(1069,56)` (`maxRestarts`: row 191's file). No error in a file of this row |
| `npx oxlint src/modules/capture-inputs src/capture/adapters/audio` | exit 0 |
| database, the same lock: `... --project db --maxWorkers=2 test/acceptance/contract.test.ts` (it uses this module's fixtures and calls operations 98 / 99; run after row 200) | `Tests 8 failed \| 31 passed (39)`: all eight on the OPERATION COUNT (99 expected, `POST /api/v1/capture/devices/address/confirm` unregistered: row 194 mid-flight), none on an audio-card operation - the run's own lines read `searchCaptureAudioCards: 200; 401; 403; 409` and `registerCaptureAudioInput: 200; 201; 400; 401; 403; 404; 409; 422`. Run twice: the second only to list the failing cases (no edit between) |
| after row 200 (the last state of the tree): `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/audio` and `npx tsc --noEmit` | `Test Files 6 passed (6)`, `Tests 180 passed (180)`; tsc: no output, exit 0 |

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | THE SERIAL IS READ FROM `/sys/class/sound/card<N>/device/../serial`, a SECOND root of the reader. The brief said "the same Linux sources the reader already reads" | `/proc/asound` states no serial (it gives `usbid`, `usbbus`, the stream files). The serial is an attribute of the USB device in the kernel's device tree. The path is an integer and fixed words; one open for reading (the static rule of the reader is green, unchanged). It widens SR-1 entry 3 by one read-only path: to be confirmed |
| DD-2 | A serial that exists and cannot be read (not ENOENT) FAILS the listing (`CardListingReadError`), it is not "no serial" | "no serial" would turn a stored serial into `SERIAL_DIFFERS`, or let a row without one match by port: a read failure must not decide an identity |
| DD-3 | `CARD_CHANGED` stores the identity of the card the technician registered and does NOT re-enable; a microphone that is ON stays on | the cell ("0 re-enabled rows") and the contract ("now names that card") together. Not switching a microphone off: this module has no such writer. Consequence stated: after a swap of an enabled microphone, ONE registration by the technician makes the new card the registered one |
| DD-4 | A USB card with neither serial nor port is refused with the existing reason `AUDIO_INPUT_NOT_REGISTRABLE` and its own fixed text | no new member of a shared closed set; the alternative was a row that no listing could ever match |

## 7. Requests (`delegation_progress/file_requests.md`)

1. R5, `packages/shared/src/api/capture-audio-cards.ts`: optional members `usbSerial`, `usbPort` of `CaptureAudioCard`; two description sentences (CARD_CHANGED does not enable; the second cause of `AUDIO_INPUT_NOT_REGISTRABLE`). The server answers NEITHER value until the members exist: the answer of operation 98 is byte-compatible with today's. Not blocking.
2. Hardware package (`9A/H-07`): steps for the serial file, the port path across a reboot and a hub power cycle, the swap of two units.
3. Controller: the three reds in files of rows 146 and 191 (section 5).

## 8. The double, and what stays unproven

Doubles: the real enumerator and parser over a table of fixed texts (a serial = the one line of the kernel's attribute, by card index); the reader over two temporary directories (there `device` is a plain directory, so `device/..` is `card<N>`; on a kernel it is a link to the USB interface and `..` is the USB device); the store double of `service.test.ts`; PostgreSQL for the statements. No Linux host, no sound card, never this Mac's microphone.

Unproven until `9A/H-07` / `9A/H-08`:
1. that `/sys/class/sound/card<N>/device/../serial` IS the serial of the card's USB device on the target kernel, and that the Core's account may read it;
2. whether the real interface states a serial, and whether it fits the closed rule (a serial with a space is read as none);
3. that the port path is the same after a reboot, after a hub power cycle and after a firmware update of the host (the controller address is part of it);
4. the swap of two units of one model on one socket without serials: not detectable by this rule;
5. operations 98 / 99 on a booted `REAL_PRODUCTION` Core (row 85).

## 9. Identifiers

AD-07 (4): closed in the server module on doubles - the stated gap of row 156 no longer exists in the product's store. The adapter's half is row 200.

---
*Generated: 2026-10-13 11:05*
