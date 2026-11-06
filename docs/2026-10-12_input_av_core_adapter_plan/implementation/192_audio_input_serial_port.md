---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 192 (added row; findings of rows 67 and 156; requirement AD-07 (4))
date: 2026-10-13
agent: database-specialist (batch 8, agent D)
tier: T3
status: needs-review - the two columns exist, are constrained, granted and tested; NOTHING WRITES OR READS THEM YET (three files of other rows, exact lines requested), and no code reads a serial number from the host
branch: task4/input-av-core-port (nothing committed, nothing staged)
---

# Row 192 - `capture_audio_inputs` gains the USB serial and the USB port path

Paths are relative to the repository root. `CS` = `apps/core-server`. Delivered in the SAME migration step as schema set B (`0017` + `0018`, schema version 8, `dbc-9`): one schema move. The delivery, the pins and the rollback are in `implementation/099_schema_set_b.md`; this record holds what is particular to the two columns.

## 1. Why

| Finding | Source |
|---|---|
| The stored row held no port and no serial number. Two connected cards of one product are refused `AUDIO_CARD_AMBIGUOUS` (a room with two identical interfaces cannot record); ONE unit swapped for another unit of the same product is matched SILENTLY | `implementation/067_usb_audio_adapter.md`; `file_requests.md`, row 67's line to the schema writer |
| The identity rule of the registration compares a port, and the product's store has none: a card of the same product on another port, alone on the host, is re-enabled silently (case marked STATED GAP) | `implementation/156_card_search_match.md` section 5 item 1 |

## 2. What was built

| Item | Built as |
|---|---|
| `usb_serial text NULL` | declared last in `captureAudioInputs` (`CS/src/db/schema/capture.ts`); `ALTER TABLE ... ADD COLUMN` in `0017`. NULL for every existing row and for a card that states none (many do not) |
| `usb_port text NULL` | the same. NULL for a card that is not USB or a host that offers no port path |
| `capture_audio_inputs_usb_serial_check`, `capture_audio_inputs_usb_port_check` | each `col IS NULL OR col ~ '^[A-Za-z0-9:._-]{1,64}$'`: a closed character set and a length. It is the rule the card listing already holds a port path to (`CS/src/capture/adapters/audio/card-listing.ts`, `USB_PORT`), so what the listing passes the table accepts. No JSON; no descriptor string as a device wrote it (AD-07 (1), S13-13) |
| Grant | `GRANT UPDATE (usb_serial, usb_port) ON capture_audio_inputs TO dems_app` in `0018`; SELECT and INSERT are the table-level ones of `0016`. The runtime role now updates ten columns of the table - still not the key, not the rate, and it still deletes no row |
| Contract delta | `changedTables` of `CS/test/db/contract-v8-delta.ts` (2 columns, 2 CHECKs) |

No unique constraint was added on (USB id, port) or on the serial: two inputs of ONE card are two rows with the same port, and a serial is not unique across cheap cards. Identity is the consumer's rule; the table holds the facts.

## 3. Proof (`CS/test/db/set9.db.test.ts`, group M9S-7; `constraints.db.test.ts`; `privileges.db.test.ts`)

| Statement | Case |
|---|---|
| Before the set the state is missing: an UPDATE of `usb_port` answers 42703 | M9S-1, third case |
| Existing rows are not rewritten and read NULL in both columns; the two CHECKs are validated; the columns are the last two | M9S-3 |
| As `dems_app`: serial and port are stored; two cards of one product on two ports are two different rows and the question "which stored input is this product on port 1-1.2" has one answer | M9S-7, first case |
| A card moved to another port is an UPDATE; a card that states neither stores NULL | M9S-7, second case |
| Refused with 23514: a serial with a space, markup, a shell sign, a line break, another script, 65 characters, empty; a port that is a file path, has a space, 65 characters, empty (11 shapes) | M9S-7, `it.each` |
| 64 characters with every admitted sign are accepted in both | M9S-7 |
| The update grant is exactly the ten columns | M9S-7, last case; the 484-column walk of `privileges.db.test.ts` |
| Undo: dropping the two columns returns the catalog to that of (7, dbc-8) | M9S-9 |

Result lines: `implementation/099_schema_set_b.md` section 6 (the runs are the same runs).

## 4. What is NOT built, and the exact lines asked (`delegation_progress/file_requests.md`, four lines of row 192)

This row edits no consumer. Until the lines below land, both columns are NULL in every row and the product behaves exactly as before.

| Consumer (owner) | Lines |
|---|---|
| The registrar's store (agent G, row 190): `CS/src/modules/capture-inputs/audio-cards/statements.ts`, `store.ts` | `READ_AUDIO_INPUT_OF_CARD` selects `i.usb_serial AS "usbSerial", i.usb_port AS "usbPort"`; `INSERT_AUDIO_INPUT` names `usb_serial, usb_port` after `usb_id` with eleven placeholders; `REFRESH_AUDIO_INPUT` sets `usb_serial = $3, usb_port = $4` (the later placeholders move by two); `cardIdentityValuesOf` returns `[input.usbId, input.usbSerial ?? null, input.usbPort ?? null]`; `AudioInputFacts` and `StoredAudioInput` gain `usbSerial`; `inputOf` answers both. A value that does not fit the pattern is written as NULL, never as it came |
| The card listing (row 64's enumerator): `CS/src/capture/adapters/audio/card-listing.ts` | THE LISTING STATES NO SERIAL TODAY (`CardUsbIdentity` = `usbId`, `usbPort`, `product`). A member `usbSerial` under a new `CardStringKind.USB_SERIAL` with the rule of `USB_PORT`. Until then only the port distinguishes two units |
| The production adapter (row 67's file): `CS/src/capture/adapters/audio/usb-audio-production.ts` | `RegisteredAudioInput` gains `usbSerial`, `usbPort`; in `identifyRegisteredCard`, after the filter by USB id: `byPort` = the entries on the stored port (all of them when the stored port is NULL); the product present and `byPort` empty -> `CARD_CHANGED`; the ambiguity test on `byPort`; both serials stated and different -> `CARD_CHANGED` |
| The card search's rule (row 156): `service.ts` `matchStoredCard` | nothing for the port (it already compares it; the STATED GAP case turns into `PORT_DIFFERS` when the store answers a port); for the serial a member `SERIAL_DIFFERS` once the listing states one |

## 5. Change set

No file of its own: every file of this row is a file of row 99 (`capture.ts`, `0017`, `0018`, the two snapshots, `contract-v8-delta.ts`, `contract-inventory.json`, `set9.db.test.ts`, `constraints.db.test.ts`, `privileges.db.test.ts`, `fixtures.ts`). The lines: the two members and two CHECKs of `captureAudioInputs`; two `ADD COLUMN` and two `ADD CONSTRAINT` statements of `0017`; one `GRANT` of `0018`.

## 6. Driver decisions (for the controller to confirm)

1. One pattern for both columns, the listing's port rule; a serial that does not fit is stored as NULL by the writer (the alternative, a wider rule for serials, would store text a device chose).
2. No uniqueness on serial or port (section 2).
3. No consumer file edited, as instructed; the product statement "a same-model card on another port is refused" is therefore NOT yet true - it becomes true with the adapter's and the store's lines.

## 7. Doubles, and what stays unproven

Fixture rows only; no sound card. Unproven until hardware (`9A/H-07`): the port text of a real host (form and length), whether the real card states a serial and whether it fits the rule, and identity after a re-plug on the same and on another port.

---
*Generated: 2026-10-13 10:50*
*Last Updated: 2026-10-13 10:50*
