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
 *
 * NO STATEMENT HERE WRITES `capture_devices` (static rule SEC35-41 (c): the one statement that
 * inserts into the registry is the capture fence's). The registry row of a microphone is written
 * by the REGISTRAR that is handed to this module (`service.ts`, `MicrophoneRegistrar`), in the
 * same unit of work; this file reads the registry row and writes the input row beside it.
 *
 * NO DEVICE TEXT. No column this file writes holds a string a sound card chose but the card id and
 * the USB id, each in the form the card listing returned it and the CHECKs of the table hold.
 */

/** Every registered sound-card input, with the microphone behind it. For the answer of operation 98. */
export const READ_REGISTERED_AUDIO_INPUTS =
  'SELECT i.device_id AS "deviceId", i.card_id AS "cardId", i.card_device AS "cardDevice", i.input_number AS "inputNumber" ' +
  'FROM public.capture_audio_inputs i ORDER BY i.card_id, i.card_device, i.input_number';

/** The stored row of ONE input of one card: `$1` the card id, `$2` the device index, `$3` the input number. */
export const READ_AUDIO_INPUT_OF_CARD =
  'SELECT i.device_id AS "deviceId", i.usb_id AS "usbId", d.enabled AS "enabled" ' +
  'FROM public.capture_audio_inputs i JOIN public.capture_devices d ON d.id = i.device_id ' +
  'WHERE i.card_id = $1 AND i.card_device = $2 AND i.input_number = $3';

/**
 * The input row of a new registration (the write AFTER the registrar's registry row). `$1` the microphone, `$2` the USB id or
 * NULL, `$3` the card id, `$4` the device index, `$5` the input number, `$6` the native channel
 * count, `$7` the sample size in bits, `$8` the operator, `$9` the instant.
 */
export const INSERT_AUDIO_INPUT =
  'INSERT INTO public.capture_audio_inputs (device_id, usb_id, card_id, card_device, input_number, native_channels, sample_bits, updated_by, updated_at) ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';

/** An input that has a row: the card facts of the new listing. The key columns and the rate are not touched. */
export const REFRESH_AUDIO_INPUT =
  'UPDATE public.capture_audio_inputs SET usb_id = $2, native_channels = $3, sample_bits = $4, updated_by = $5, updated_at = $6 WHERE device_id = $1';

/** The statements of this file that write, for the static rules of the module. */
export const CAPTURE_AUDIO_CARD_WRITES: readonly string[] = Object.freeze([INSERT_AUDIO_INPUT, REFRESH_AUDIO_INPUT]);
