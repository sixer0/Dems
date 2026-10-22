/**
 * The statements of the microphone registration (task 4, blueprint row 70, package WP-07c; design
 * addendum 04 section 4.2 "Where it is stored"; schema set A, `capture_audio_inputs`, contract
 * revision dbc-8; security addendum AD-07).
 *
 * Every statement is a constant text with bind parameters; no value is ever part of a statement
 * text. They run as the runtime role `dems_app`, inside ONE unit of work: the registry row of the
 * microphone, its sound-card input row and the audit entry commit together or not at all.
 *
 * WHAT THE RUNTIME ROLE MAY DO (migration 0016). `capture_audio_inputs`: SELECT, INSERT, UPDATE of
 * eight columns, never `device_id` or `sample_rate`. No DELETE: an input row is never removed.
 * Migration 0018 (schema set B, task 4 row 192) adds the UPDATE of `usb_serial` and `usb_port`:
 * ten columns. Both are written by the two statements below since row 199.
 *
 * NO STATEMENT HERE WRITES `capture_devices` (static rule SEC35-41 (c): the one statement that
 * inserts into the registry is the capture fence's). The registry row of a microphone is written
 * by the REGISTRAR that is handed to this module (`service.ts`, `MicrophoneRegistrar`), in the
 * same unit of work; this file reads the registry row and writes the input row beside it.
 *
 * NO DEVICE TEXT. No column this file writes holds a string a sound card chose but the card id and
 * the USB id, the USB serial and the USB port path, each in the form the card listing returned it
 * and the CHECKs of the table hold (the serial and the port: letters, digits and `: . _ -`, 1 to
 * 64, or NULL; `store.ts` binds NULL for anything else).
 */

/**
 * Every registered sound-card input, with the microphone behind it and the stored identity of its
 * card (row 199: operation 98 names an input as registered on a listed card only when that card IS
 * the stored one by the identity rule). For the answer of operation 98. Live rows only (R-FLEX
 * row 108, spec D-A3.4): a retired row is no registered input.
 */
export const READ_REGISTERED_AUDIO_INPUTS =
  'SELECT i.device_id AS "deviceId", i.card_id AS "cardId", i.card_device AS "cardDevice", i.input_number AS "inputNumber", ' +
  'i.usb_id AS "usbId", i.usb_serial AS "usbSerial", i.usb_port AS "usbPort" ' +
  'FROM public.capture_audio_inputs i WHERE i.retired_at IS NULL ORDER BY i.card_id, i.card_device, i.input_number';

/**
 * The stored LIVE row of ONE input of one card: `$1` the card id, `$2` the device index, `$3` the
 * input number. A retired row under the same key is not read (R-FLEX row 108, spec D-A3.4): the
 * unique key holds live rows only (migration 0032), so the key of a retired row is free again.
 */
export const READ_AUDIO_INPUT_OF_CARD =
  'SELECT i.device_id AS "deviceId", i.usb_id AS "usbId", i.usb_serial AS "usbSerial", i.usb_port AS "usbPort", d.enabled AS "enabled" ' +
  'FROM public.capture_audio_inputs i JOIN public.capture_devices d ON d.id = i.device_id ' +
  'WHERE i.card_id = $1 AND i.card_device = $2 AND i.input_number = $3 AND i.retired_at IS NULL';

/**
 * The input row of a new registration (the write AFTER the registrar's registry row). `$1` the
 * microphone; `$2`, `$3`, `$4` THE CARD IDENTITY VALUES in the order of `cardIdentityValuesOf`
 * (`store.ts`): the USB id, the USB serial, the USB port path, each or NULL; `$5` the card id,
 * `$6` the device index, `$7` the input number, `$8` the native channel count, `$9` the sample
 * size in bits, `$10` the operator, `$11` the instant.
 */
export const INSERT_AUDIO_INPUT =
  'INSERT INTO public.capture_audio_inputs (device_id, usb_id, usb_serial, usb_port, card_id, card_device, input_number, native_channels, sample_bits, updated_by, updated_at) ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)';

/**
 * An input that has a row: the card facts of the new listing, the three identity values (`$2`,
 * `$3`, `$4`, as above) among them. The key columns and the rate are not touched.
 */
export const REFRESH_AUDIO_INPUT =
  'UPDATE public.capture_audio_inputs SET usb_id = $2, usb_serial = $3, usb_port = $4, native_channels = $5, sample_bits = $6, updated_by = $7, updated_at = $8 WHERE device_id = $1';

/**
 * THE HOLDERS OF ONE CARD (R-FLEX register DB-A2; row 130, spec `01_specs_rflex_database.md` 3.2):
 * every LIVE input row (`retired_at IS NULL`) of one USB id. `$1` the USB id of the live card. The
 * service applies the identity rule to the answer and leaves out the row of the key being
 * registered (row 131); a retired row never holds a card.
 *
 * A row with NEITHER a serial NOR a port path is read too (R-FLEX row 108, decision D24; bundle M,
 * Q96-09 a, T-16): it is "no serial", the serial-less unit of its model, and holds its card like
 * any other row. The bundle-C filter `usb_serial IS NOT NULL OR usb_port IS NOT NULL` is gone.
 * ORDER BY the microphone id: the FIRST holder (X-2, several holders in an older database) is the
 * lowest MIC id, for operation 98 `boundTo` and the refusal of operation 99 alike.
 */
export const READ_BOUND_AUDIO_INPUTS =
  'SELECT i.device_id AS "deviceId", i.card_device AS "cardDevice", i.input_number AS "inputNumber", ' +
  'i.usb_serial AS "usbSerial", i.usb_port AS "usbPort" ' +
  'FROM public.capture_audio_inputs i ' +
  'WHERE i.usb_id = $1 AND i.retired_at IS NULL ' +
  'ORDER BY i.device_id';

/**
 * A PORT MOVE OR A RELEASE RE-KEYS ONE LIVE ROW (R-FLEX register DB-A6; row 130): the same
 * microphone, its row moved to a new kernel key. `$1` the microphone; `$2`, `$3`, `$4` the card
 * identity values in the order of `cardIdentityValuesOf` (`store.ts`); `$5` the card id, `$6` the
 * device index, `$7` the input number, `$8` the operator, `$9` the instant. Only a live row
 * (`retired_at IS NULL`); the caller requires a row count of 1.
 *
 * Every column set here is granted to the runtime role: `usb_id`, `card_id`, `card_device`,
 * `input_number`, `updated_by`, `updated_at` by migration 0016 (lines 35-36), `usb_serial` and
 * `usb_port` by migration 0018 (line 40). Never `device_id`, `sample_rate` or `retired_at`.
 */
export const REKEY_AUDIO_INPUT =
  'UPDATE public.capture_audio_inputs SET usb_id = $2, usb_serial = $3, usb_port = $4, card_id = $5, card_device = $6, input_number = $7, updated_by = $8, updated_at = $9 ' +
  'WHERE device_id = $1 AND retired_at IS NULL';

/** The statements of this file that write, for the static rules of the module. */
export const CAPTURE_AUDIO_CARD_WRITES: readonly string[] = Object.freeze([INSERT_AUDIO_INPUT, REFRESH_AUDIO_INPUT, REKEY_AUDIO_INPUT]);
