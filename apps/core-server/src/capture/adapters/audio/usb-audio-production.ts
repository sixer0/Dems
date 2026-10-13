/**
 * The PRODUCTION microphone adapter, adapter kind `USB_AUDIO` (task 4 row 67, WP-08; design
 * addendum 4.1 d, 4.2 "Arguments of the helper", 6.2; security addendum AD-07 (2) (4), AD-09 (3);
 * review P12-F13; specification S3-2, S3-4, S3-5).
 *
 * REGISTERED NOWHERE. The registered adapter of the kind is still the class-C stub beside this
 * file (`usb-audio.ts`), loaded by `real.ts`; nothing in `src/` imports this file, and a registry
 * refuses it (`CAPTURE_ADAPTER_INVALID`: it states an opener for a kind that has none before the
 * lift, WP-13c). It exists so that the opener can be built and tested before the lift.
 *
 * A microphone of a production room is ONE INPUT of a USB sound card on a Linux host. What this
 * file does, in the order of an `open`:
 *
 *   1. reads the STORED row of the registered input through an injected reader (the row of
 *      `capture_audio_inputs`: USB id, card id, device index, input number, native channels);
 *   2. enumerates the cards FRESH through the injected enumerator (`card-listing.ts`): two opens
 *      are two listings, nothing of a listing is kept for a later open;
 *   3. RE-IDENTIFIES the card by its stored identity and NEVER by a card index
 *      (`identifyRegisteredCard`). A card index is the number of one listing: it moves when cards
 *      are plugged in another order. The identity is the USB id AND THE SERIAL the card stated
 *      at its registration, ELSE THE USB PORT PATH it was registered on (task 4 rows 192, 199,
 *      200): a card of the same model on another port, or with another serial, is NOT the
 *      registered card. A card that is not there is `AUDIO_CARD_ABSENT`; ANOTHER card - under the
 *      registered card's name, or of its model elsewhere - is `AUDIO_CARD_CHANGED`; a stored row
 *      that holds neither a serial nor a port is `AUDIO_CARD_UNIDENTIFIED`; two cards that state
 *      the stored serial, with no port to say which, are `AUDIO_CARD_AMBIGUOUS`. No path of this
 *      file chooses "a" card: the generic source of input-av, which moved two microphones to a
 *      swapped sound card without a word, is not ported;
 *   4. refuses an input beyond the card's channels by `AUDIO_INPUT_BEYOND_CARD`, a card whose
 *      channel count is a guess, and a card that cannot run at the transport's rate;
 *   5. generates the shared-capture configuration for the cards of every input it holds open
 *      (`alsa-config.ts`, written by `alsa-config-writer.ts`): one configuration, one entry per
 *      card, so that two inputs of one card are two helpers on one shared capture;
 *   6. creates the named pipe of the existing microphone transport (`mic-transport.ts`,
 *      `local/mic-pipe.ts`) and builds the helper's arguments with the Linux table
 *      (`local/mic-helper-args.ts`) FROM INTEGERS ONLY: the card index, the device index and the
 *      channel count of THIS listing, and the registered input number as an index into the
 *      table's 64 selections, bounded by the live channel count. No text of the stored row and
 *      no text of the listing (card id, USB id, port, product, format) reaches an argument.
 *
 * `open` starts NO helper (the plan needs the pipe path before the worker can read it). `start`
 * lists the cards once more, refuses when the card is no longer where the open found it
 * (`AUDIO_CARD_MOVED`), and starts the helper UNDER THE GUARD through the production door, with
 * the path of the configuration as the one environment key. The guard ends its child when its
 * own standard input ends, and the door keeps that input open: the helper follows the liveness
 * rule of every production program. `close` ends the guard's input, then signals, waits for the
 * end, and removes the pipe. A handle starts ONCE: a helper that has ended is not started again
 * on the same handle (see the record of the row, "re-open").
 *
 * THE FIRST SAMPLES. This file does nothing to them: the pipe carries what the card delivers
 * from the helper's first sample (the worker places by arrival, so the writer must not hold or
 * cut anything). The full-scale sample input-av saw at the first open of a card after plug-in
 * is an OPEN POINT of the hardware check (record, section "unproven").
 *
 * It does not log (the capture folder logs in one place): a refusal is a `UsbAudioError` with a
 * code and a short detail word, never a value; what is not an error is told to `onNotice`.
 *
 * NOT PROVEN ON THIS HOST (no Linux, no sound card): everything the helper does with a card.
 * Hardware checks `9A/H-07`, `9A/H-08`.
 */
import { CaptureMicInputKind } from '@dems/capture-protocol';
import type { CaptureTimers } from '../../types';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind, sourceClassOf } from '../kinds';
import { FIRST_DELIVERY_MS, createDeliveryWatch } from '../local/camera-helper';
import { helperProgramRefusal } from '../local/helper-program';
import { linuxMicPrecheckArguments, linuxMicPushArguments } from '../local/mic-helper-args';
import { preparePipe, removePipe } from '../local/mic-pipe';
import { createPipeFiles, type PipeFiles } from '../local/pipe-files';
import { inspectProgram, type HelperDoor, type ProgramInspector } from '../local/process-door';
import { MIC_TRANSPORTS } from '../mic-transport';
import { startProductionProcess, type ProductionDoor, type ProductionEnvironment, type ProductionExit, type ProductionProcess } from '../production-door';
import { AudioInputBeyondCardError, AudioInputErrorCode, type AudioInputAdapter, type AudioInputDescriptor, type AudioOpenTarget, type AudioStreamHandle, type CaptureDeviceEntry } from '../types';
import { ensureAlsaConfig, sharedCaptureOfCard, type AlsaConfigResult, type AlsaConfigWriter, type SharedCaptureCard } from './alsa-config';
import { CARD_USB_ID_REPLACEMENT, CardFactsSource, isKernelCardId, type CaptureCard, type CardEnumerator, type CardListing } from './card-listing';

// ── Refusals ──────────────────────────────────────────────────────────────────────────────────

export const UsbAudioRefusal = {
  /** No stored row for the device, or a row that is not of its shape. */
  INPUT_NOT_REGISTERED: 'AUDIO_INPUT_NOT_REGISTERED',
  /** The cards could not be listed. */
  LISTING_FAILED: 'AUDIO_CARD_LISTING_FAILED',
  /** The registered card is not in the listing. No other card is taken in its place. */
  CARD_ABSENT: 'AUDIO_CARD_ABSENT',
  /**
   * Another card sits where the registered one is looked for: under its kernel name with another
   * USB id, or a card of the SAME MODEL that is not the registered unit - on another port, or with
   * another serial (row 200). It is not recorded from. The detail word says which.
   */
  CARD_CHANGED: 'AUDIO_CARD_CHANGED',
  /** More than one connected card states the stored serial, and the stored port does not say which was registered. */
  CARD_AMBIGUOUS: 'AUDIO_CARD_AMBIGUOUS',
  /**
   * There is nothing to re-find the card by: the stored USB id is the fixed word of an id that
   * could not be read, or the stored row of a USB card holds neither a serial nor a port path (a
   * row written before those columns existed: it must be registered again).
   */
  CARD_UNIDENTIFIED: 'AUDIO_CARD_UNIDENTIFIED',
  /** The channel count of the card is a guess: it is not opened with a guessed count. */
  CARD_FACTS_UNKNOWN: 'AUDIO_CARD_FACTS_UNKNOWN',
  /** The card cannot run at the rate of the transport. */
  CARD_RATE_UNSUPPORTED: 'AUDIO_CARD_RATE_UNSUPPORTED',
  /** At the start: the card is no longer where the open found it. */
  CARD_MOVED: 'AUDIO_CARD_MOVED',
  /** The shared-capture configuration could not be generated or written. */
  CONFIG_REFUSED: 'AUDIO_SHARED_CAPTURE_REFUSED',
  /** The helper or the guard is refused by the program path rule. */
  PROGRAM_REFUSED: 'AUDIO_PROGRAM_REFUSED',
  /** The named pipe could not be made. */
  PIPE_REFUSED: 'AUDIO_PIPE_REFUSED',
  /** A value of the helper's argument table is not of its shape. */
  ARGUMENT_REFUSED: 'AUDIO_HELPER_ARGUMENT_REFUSED',
  /** The input is open already, or its handle was started before. */
  ALREADY_OPEN: 'AUDIO_INPUT_ALREADY_OPEN',
  ABORTED: 'AUDIO_OPEN_ABORTED',
  /** The door did not start the guard. */
  HELPER_NOT_STARTED: 'AUDIO_HELPER_NOT_STARTED',
  /** The helper ended while it was being started. */
  HELPER_ENDED_AT_START: 'AUDIO_HELPER_ENDED_AT_START',
  /** The helper ended during the session, not on this unit's request. */
  HELPER_EXITED: 'AUDIO_HELPER_EXITED',
  /** The helper lived but reported no sample within the bound: it was stopped. */
  NO_SAMPLE: 'AUDIO_NO_SAMPLE_WITHIN_BOUND',
  /** The short open of the pre-check did not end within its bound. */
  PRECHECK_TIMEOUT: 'AUDIO_PRECHECK_TIMEOUT',
} as const;
export type UsbAudioRefusal = (typeof UsbAudioRefusal)[keyof typeof UsbAudioRefusal];

const TEXT: Readonly<Record<UsbAudioRefusal, string>> = Object.freeze({
  AUDIO_INPUT_NOT_REGISTERED: 'the microphone has no registered sound card input',
  AUDIO_CARD_LISTING_FAILED: 'the sound cards could not be listed',
  AUDIO_CARD_ABSENT: 'the registered sound card is not connected',
  AUDIO_CARD_CHANGED: 'another sound card sits where the registered one was',
  AUDIO_CARD_AMBIGUOUS: 'more than one connected sound card carries the registered identity',
  AUDIO_CARD_UNIDENTIFIED: 'the registered sound card has no identity to find it by',
  AUDIO_CARD_FACTS_UNKNOWN: 'the channel count of the sound card is not known',
  AUDIO_CARD_RATE_UNSUPPORTED: 'the sound card does not offer the rate of the microphone transport',
  AUDIO_CARD_MOVED: 'the sound card is no longer where it was found when the microphone was opened',
  AUDIO_SHARED_CAPTURE_REFUSED: 'the shared-capture configuration could not be made',
  AUDIO_PROGRAM_REFUSED: 'a program of the microphone helper is refused by the path rule',
  AUDIO_PIPE_REFUSED: 'the pipe of the microphone could not be made',
  AUDIO_HELPER_ARGUMENT_REFUSED: 'a value of the microphone helper is not of its shape',
  AUDIO_INPUT_ALREADY_OPEN: 'the microphone is open already',
  AUDIO_OPEN_ABORTED: 'the call was aborted',
  AUDIO_HELPER_NOT_STARTED: 'the microphone helper could not be started',
  AUDIO_HELPER_ENDED_AT_START: 'the microphone helper ended while it was being started',
  AUDIO_HELPER_EXITED: 'the microphone helper ended early',
  AUDIO_NO_SAMPLE_WITHIN_BOUND: 'the microphone helper delivered no sample in time',
  AUDIO_PRECHECK_TIMEOUT: 'the short open of the sound card did not end in time',
});

/** The cause of the closed wire vocabulary (C3 op 97) each refusal is shown as. */
const WIRE: Readonly<Record<UsbAudioRefusal, AudioInputErrorCode>> = Object.freeze({
  AUDIO_INPUT_NOT_REGISTERED: AudioInputErrorCode.DEVICE_NOT_FOUND,
  AUDIO_CARD_LISTING_FAILED: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_CARD_ABSENT: AudioInputErrorCode.DEVICE_NOT_FOUND,
  AUDIO_CARD_CHANGED: AudioInputErrorCode.DEVICE_NOT_FOUND,
  AUDIO_CARD_AMBIGUOUS: AudioInputErrorCode.DEVICE_NOT_FOUND,
  AUDIO_CARD_UNIDENTIFIED: AudioInputErrorCode.DEVICE_NOT_FOUND,
  AUDIO_CARD_FACTS_UNKNOWN: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_CARD_RATE_UNSUPPORTED: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_CARD_MOVED: AudioInputErrorCode.DEVICE_NOT_FOUND,
  AUDIO_SHARED_CAPTURE_REFUSED: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_PROGRAM_REFUSED: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_PIPE_REFUSED: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_HELPER_ARGUMENT_REFUSED: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_INPUT_ALREADY_OPEN: AudioInputErrorCode.DEVICE_BUSY,
  AUDIO_OPEN_ABORTED: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_HELPER_NOT_STARTED: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_HELPER_ENDED_AT_START: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_HELPER_EXITED: AudioInputErrorCode.HELPER_EXITED,
  AUDIO_NO_SAMPLE_WITHIN_BOUND: AudioInputErrorCode.OPEN_FAILED,
  AUDIO_PRECHECK_TIMEOUT: AudioInputErrorCode.OPEN_FAILED,
});

const DETAIL_WORD = /^[A-Z][A-Z0-9_]{0,47}$/;
const NO_DETAIL = 'NONE';

/**
 * A refusal of this adapter: a code, the wire cause it is shown as, a registry id and a DETAIL
 * WORD (the short code of the step that failed, such as `EACCES` or `EXIT_1`). Fixed text: no
 * card name, no USB id, no path and no output of a program is ever part of it.
 */
export class UsbAudioError extends Error {
  readonly code: UsbAudioRefusal;
  readonly wireCode: AudioInputErrorCode;
  /** The microphone the refusal is about (`MIC-NN`), or null. */
  readonly deviceId: string | null;
  readonly detail: string;
  constructor(code: UsbAudioRefusal, deviceId: string | null = null, detail: string = NO_DETAIL) {
    super(TEXT[code]);
    this.name = 'UsbAudioError';
    this.code = code;
    this.wireCode = WIRE[code];
    this.deviceId = deviceId;
    this.detail = DETAIL_WORD.test(detail) ? detail : NO_DETAIL;
  }
}

/** The short code an error of another unit carries (`what`, `reason` or `code`), as a detail word. Never its message. */
function detailOf(error: unknown): string {
  const carried = error as { what?: unknown; reason?: unknown; code?: unknown } | null;
  for (const word of [carried?.what, carried?.reason, carried?.code]) if (typeof word === 'string' && DETAIL_WORD.test(word)) return word;
  return NO_DETAIL;
}

function detailOfExit(exit: ProductionExit): string {
  if (exit.spawnFailed) return 'NOT_STARTED';
  if (typeof exit.signal === 'string' && DETAIL_WORD.test(exit.signal)) return exit.signal;
  return typeof exit.exitCode === 'number' && Number.isInteger(exit.exitCode) && exit.exitCode >= 0 && exit.exitCode <= 255 ? `EXIT_${String(exit.exitCode)}` : NO_DETAIL;
}

// ── Notices: what is told, and is no refusal ──────────────────────────────────────────────────

export const UsbAudioNoticeCode = {
  /** The one card with the stored USB id has another kernel name than the stored one. It is used; the registration should be refreshed. */
  CARD_RENAMED: 'AUDIO_CARD_RENAMED',
  /** The card has another native channel count than the stored row says. The live count is used. */
  CARD_CHANNELS_DIFFER: 'AUDIO_CARD_CHANNELS_DIFFER',
  /** The guard did not end when its input ended: it was signalled. */
  HELPER_SIGNALLED: 'AUDIO_HELPER_SIGNALLED',
  /** The pipe of a closed microphone could not be removed. */
  PIPE_NOT_REMOVED: 'AUDIO_PIPE_NOT_REMOVED',
} as const;
export type UsbAudioNoticeCode = (typeof UsbAudioNoticeCode)[keyof typeof UsbAudioNoticeCode];

export interface UsbAudioNotice {
  readonly code: UsbAudioNoticeCode;
  readonly deviceId: string;
}

// ── The stored row and the match ──────────────────────────────────────────────────────────────

/** The stored row of a registered input (`capture_audio_inputs`), read by the unit that wires this adapter. */
export interface RegisteredAudioInput {
  /** The registry id of the microphone (`MIC-NN`). */
  readonly deviceId: string;
  /** `vvvv:pppp`, or null for a card that is not USB. */
  readonly usbId: string | null;
  /** The kernel's short name of the card at the registration. */
  readonly cardId: string;
  readonly cardDevice: number;
  /** The input of the card, numbered from 1. */
  readonly inputNumber: number;
  /** The native channel count of the card at the registration. Compared, never used to open. */
  readonly nativeChannels: number;
  /**
   * The serial number the card stated at the registration (`capture_audio_inputs.usb_serial`; task
   * 4 rows 192, 199), or null: it stated none. ABSENT is read as null - a reader that does not
   * hand the column over yields a row with no serial.
   */
  readonly usbSerial?: string | null;
  /**
   * The USB port path the input was registered on (`capture_audio_inputs.usb_port`), or null.
   * ABSENT is read as null. A row of a USB card with neither value identifies no card
   * (`AUDIO_CARD_UNIDENTIFIED`): it is never matched by its USB id alone.
   */
  readonly usbPort?: string | null;
}

const MIC_ID = /^MIC-[0-9]{2,}$/;
const USB_ID = /^[0-9a-f]{4}:[0-9a-f]{4}$/;
/** The closed form of a stored serial and of a stored port path (the CHECKs of the two columns; the rule of the listing for both). */
const IDENTITY_TEXT = /^[A-Za-z0-9:._-]{1,64}$/;
const wholeIn = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const identityShape = (value: unknown): boolean => value === undefined || value === null || (typeof value === 'string' && IDENTITY_TEXT.test(value));
/** A serial or a port path of either side: the text, or null for none (absent and null alike). */
const identityText = (value: string | null | undefined): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** True for a stored row of its shape (the CHECKs of the table, held again here). */
export function isRegisteredAudioInput(row: RegisteredAudioInput | null | undefined): row is RegisteredAudioInput {
  if (row === null || row === undefined || typeof row.deviceId !== 'string' || !MIC_ID.test(row.deviceId)) return false;
  if (row.usbId !== null && (typeof row.usbId !== 'string' || !USB_ID.test(row.usbId))) return false;
  if (!identityShape(row.usbSerial) || !identityShape(row.usbPort)) return false;
  return isKernelCardId(row.cardId) && wholeIn(row.cardDevice, 0, 31) && wholeIn(row.inputNumber, 1, 64) && wholeIn(row.nativeChannels, 1, 64) && row.inputNumber <= row.nativeChannels;
}

/** Why a stored row matched no card, as a DETAIL WORD of the refusal: a code of the rule, never a serial, a port or a USB id. */
export const CardMismatch = {
  /** Another USB id under the registered card's kernel name. */
  USB_ID_DIFFERS: 'USB_ID_DIFFERS',
  /** The model is connected, and no unit of it states the stored serial - or the unit on the stored port states a serial where none was stored. */
  SERIAL_DIFFERS: 'SERIAL_DIFFERS',
  /** No serial was stored, the model is connected, and no unit of it sits on the stored port. */
  PORT_DIFFERS: 'PORT_DIFFERS',
  /** The stored row of a USB card holds neither a serial nor a port path. */
  IDENTITY_NOT_STORED: 'IDENTITY_NOT_STORED',
  /** Two connected units state the stored serial and the stored port names neither, or both. */
  SERIAL_SHARED: 'SERIAL_SHARED',
} as const;
export type CardMismatch = (typeof CardMismatch)[keyof typeof CardMismatch];

export type CardIdentification =
  | { readonly ok: true; readonly card: CaptureCard; /** True when the card was found by its identity under another kernel name. */ readonly renamed: boolean }
  | { readonly ok: false; readonly refusal: UsbAudioRefusal; /** Why, where the rule has a word for it. */ readonly detail?: CardMismatch };

const notFound = (refusal: UsbAudioRefusal, detail?: CardMismatch): CardIdentification => Object.freeze(detail === undefined ? { ok: false, refusal } : { ok: false, refusal, detail });

/**
 * THE MATCH of a stored row to a card of ONE listing (AD-07 (4); task 4 rows 67, 192, 199, 200).
 * It reads the TEXT of the listing (USB id, serial, port path, card id) and the device index; it
 * never reads a card index, so a card that came back at another index is found, and a card that
 * sits at the old index is not taken for it. The same rule as the registration's
 * (`modules/capture-inputs/audio-cards/service.ts`, `matchStoredCard`), which this layer does not
 * import: BY THE SERIAL, ELSE BY THE PORT PATH, never by the USB id alone.
 *
 *   stored row of a card that is not USB     the one entry with the stored card id, and only if
 *                                            it is not a USB card; a USB card under that name is
 *                                            `CARD_CHANGED`.
 *   stored USB id is the fixed word          `CARD_UNIDENTIFIED`: two unreadable ids are not one
 *                                            identity.
 *   stored: no serial AND no port path       `CARD_UNIDENTIFIED` (a row of before the columns):
 *                                            the USB id alone finds no card, whatever is connected.
 *   no connected card carries the USB id     `CARD_CHANGED` when an entry carries the stored card
 *                                            id (another card under that name), else `CARD_ABSENT`.
 *   a serial is stored                       the ONE connected unit of the model that states it,
 *                                            on WHATEVER port (the card was moved). None states
 *                                            it: `CARD_CHANGED` - a unit of the model is there and
 *                                            it is not the registered one. Two state it: the one
 *                                            on the stored port, else `CARD_AMBIGUOUS`.
 *   no serial is stored                      the unit of the model ON THE STORED PORT. None there:
 *                                            `CARD_CHANGED` (the same model elsewhere is never
 *                                            opened in its place). The unit there states a serial:
 *                                            `CARD_CHANGED` (the registered card stated none).
 *
 * NOT DETECTABLE, stated: two units of one model that state no serial, exchanged on the SAME
 * socket, are one identity.
 */
export function identifyRegisteredCard(listing: CardListing, stored: RegisteredAudioInput): CardIdentification {
  const entries = listing.cards.filter((card) => card.deviceIndex === stored.cardDevice);
  const named = entries.filter((card) => card.cardId === stored.cardId);
  if (stored.usbId === null) {
    const [card] = named;
    if (card === undefined || named.length !== 1) return notFound(UsbAudioRefusal.CARD_ABSENT);
    return card.usb ? notFound(UsbAudioRefusal.CARD_CHANGED) : Object.freeze({ ok: true, card, renamed: false });
  }
  if (stored.usbId === CARD_USB_ID_REPLACEMENT) return notFound(UsbAudioRefusal.CARD_UNIDENTIFIED);
  const storedSerial = identityText(stored.usbSerial);
  const storedPort = identityText(stored.usbPort);
  if (storedSerial === null && storedPort === null) return notFound(UsbAudioRefusal.CARD_UNIDENTIFIED, CardMismatch.IDENTITY_NOT_STORED);
  const same = entries.filter((card) => card.usb && card.usbId === stored.usbId);
  if (same.length === 0) return named.length > 0 ? notFound(UsbAudioRefusal.CARD_CHANGED, CardMismatch.USB_ID_DIFFERS) : notFound(UsbAudioRefusal.CARD_ABSENT);
  const found = (card: CaptureCard): CardIdentification => Object.freeze({ ok: true, card, renamed: card.cardId !== stored.cardId });
  if (storedSerial !== null) {
    const bySerial = same.filter((card) => identityText(card.usbSerial) === storedSerial);
    const [only] = bySerial;
    if (only === undefined) return notFound(UsbAudioRefusal.CARD_CHANGED, CardMismatch.SERIAL_DIFFERS);
    if (bySerial.length === 1) return found(only);
    // Two units state the stored serial (cheap cards share one): only the stored port can say which was registered.
    const onPort = storedPort === null ? [] : bySerial.filter((card) => identityText(card.usbPort) === storedPort);
    const [there] = onPort;
    return there !== undefined && onPort.length === 1 ? found(there) : notFound(UsbAudioRefusal.CARD_AMBIGUOUS, CardMismatch.SERIAL_SHARED);
  }
  const onPort = same.filter((card) => identityText(card.usbPort) === storedPort);
  const [there] = onPort;
  if (there === undefined) return notFound(UsbAudioRefusal.CARD_CHANGED, CardMismatch.PORT_DIFFERS);
  if (onPort.length > 1) return notFound(UsbAudioRefusal.CARD_AMBIGUOUS);
  // The registered card stated no serial; the unit on its port states one: not known to be the registered card.
  if (identityText(there.usbSerial) !== null) return notFound(UsbAudioRefusal.CARD_CHANGED, CardMismatch.SERIAL_DIFFERS);
  return found(there);
}

// ── Options, limits, the handle ───────────────────────────────────────────────────────────────

export interface UsbAudioLimits {
  /** A helper that is still alive this long after its start has opened its input. */
  readonly settleMs: number;
  /** From the start of the helper to its first reported sample; past it the helper is stopped. */
  readonly firstSampleMs: number;
  /** After the end of the guard's input: this long, then SIGTERM. */
  readonly stopGraceMs: number;
  /** After SIGTERM: this long, then SIGKILL. */
  readonly killGraceMs: number;
  /** The pre-check opens the card for a fraction of a second; bounded. */
  readonly precheckTimeoutMs: number;
}

/** The figures of the local helper (`MIC_HELPER_LIMITS`), with a second grace for the guard. */
export const USB_AUDIO_LIMITS: UsbAudioLimits = Object.freeze({ settleMs: 1_500, firstSampleMs: FIRST_DELIVERY_MS, stopGraceMs: 3_000, killGraceMs: 2_000, precheckTimeoutMs: 5_000 });

export interface UsbAudioProductionOptions {
  /** The registered microphones this adapter serves. */
  readonly devices: readonly CaptureDeviceEntry[];
  /** The stored row of a microphone, read at every open; null when it has none. */
  readonly registered: (deviceId: string) => Promise<RegisteredAudioInput | null>;
  /** The card listing. Every call of `list` reads the host again. */
  readonly cards: CardEnumerator;
  /** The writer of the shared-capture configuration, bound to `runDir`. */
  readonly configWriter: AlsaConfigWriter;
  /** The helper program: an absolute path of the configuration. */
  readonly helperProgram: string;
  /** The guard program (`DEMS_CAPTURE_GUARD`): an absolute path of the configuration. The helper is started by it, never directly. */
  readonly guardProgram: string;
  /** `<dataDir>/run/capture`: the pipes of the sessions and the configuration live below it. */
  readonly runDir: string;
  readonly timers: CaptureTimers;
  readonly limits?: Partial<UsbAudioLimits>;
  /** The production door. Default: the real one. A test passes one that starts nothing. */
  readonly door?: ProductionDoor;
  readonly inspect?: ProgramInspector;
  readonly files?: PipeFiles;
  /** dBFS from the worker's telemetry for a device id, or null. Default: always null (the helper has no meter). */
  readonly level?: (inputId: string) => number | null;
  /** Told once when the helper of a started microphone ends during a session. */
  readonly onSourceLost?: (deviceId: string, error: UsbAudioError) => void;
  /** Told what is no refusal. The observer must not throw; a throw is dropped. */
  readonly onNotice?: (notice: UsbAudioNotice) => void;
}

/** What an open found about the card, for the session's source facts. The text has passed the rule of the listing; none of it is an argument. */
export interface UsbAudioCardFacts {
  readonly cardIndex: number;
  readonly deviceIndex: number;
  readonly channelCount: number;
  readonly inputNumber: number;
  readonly rateHz: number;
  readonly nativeFormat: string;
  /** The width of the samples that reach the pipe: the card's own width, at most the 24 bits the helper captures. */
  readonly sampleBits: number;
  readonly cardId: string;
  readonly usbId: string | null;
  /** The serial the card that was OPENED states in the listing of the open, or null (row 200). The live value, not the stored one. */
  readonly usbSerial: string | null;
  /** The port path the card that was OPENED sits on in the listing of the open, or null (row 200). The live value, not the stored one. */
  readonly usbPort: string | null;
  readonly product: string;
}

/**
 * What the adapter states of the card behind one OPEN input, for the session's source facts (row
 * 71; the shape of the fence's `AudioCardStatement`, which this layer does not import).
 *
 * `usbSerial` and `usbPort` (row 200) are the serial and the port path ACTUALLY USED: those of the
 * card the open found, as its listing stated them. They are stated here; the session row holds
 * them once the fence's closed key list has the two keys (requested: `capture/fence/sources.ts`).
 */
export interface UsbAudioSourceStatement {
  readonly product: string;
  readonly usbId: string | null;
  readonly usbSerial: string | null;
  readonly usbPort: string | null;
  readonly cardId: string;
  readonly cardDevice: number;
  readonly inputNumber: number;
  readonly nativeChannels: number;
  readonly sampleRateHz: number;
  readonly sampleBits: number;
}

/** The bits of a native format (`S16_LE` 16, `S24_3LE` and `S24_LE` 24, `S32_LE` 32), by its name of the closed list. */
const BITS_OF_FORMAT: Readonly<Record<string, number>> = Object.freeze({ S16_LE: 16, S24_3LE: 24, S24_LE: 24, S32_LE: 32 });
/** The helper captures 24-bit samples (`pcm_s24le` of the Linux table; check E-6 of the transport). */
const CAPTURE_BITS = 24;

export interface UsbAudioStream extends AudioStreamHandle {
  /** Starts the helper under the guard. Resolves when it has stayed alive for the settle time; rejects with a `UsbAudioError`. Call `close()` after a failure. */
  start(signal?: AbortSignal): Promise<void>;
  /** True once `start` was called (also when it then failed): a handle starts once. */
  started(): boolean;
  /** Calls the listener once if the helper ends during the session without a `close()`. Returns a function that removes it. */
  onLost(listener: (error: UsbAudioError) => void): () => void;
  /** The process id of the guard once started, for the leftover check; null otherwise. */
  guardPid(): number | null;
  /** The argument list of the HELPER (after the guard's own first argument, the helper program). */
  readonly helperArguments: readonly string[];
  readonly card: UsbAudioCardFacts;
}

export interface UsbAudioProductionAdapter extends AudioInputAdapter {
  open(inputId: string, target: AudioOpenTarget): Promise<UsbAudioStream>;
  /** One short open of the card through the shared capture, nothing written. Null when it worked; else the named refusal. */
  precheck(inputId: string, signal?: AbortSignal): Promise<UsbAudioError | AudioInputBeyondCardError | null>;
  /**
   * The card behind an OPEN input, from what the open found: no listing, no process, no file.
   * Null for an input that is not open.
   */
  sourceFacts(inputId: string): UsbAudioSourceStatement | null;
  /** The microphones whose pipe is prepared or whose helper runs. */
  openSources(): readonly string[];
  /** The process ids of the guards that run now, so that a leftover check does not count them. */
  livePids(): ReadonlySet<number>;
  /** Stops every helper and removes every pipe: the shutdown hook. */
  closeAll(): Promise<void>;
  /**
   * THE DOOR OF A LATER DEVICE (task 4 row 85d; decision C63 (g); `LateDeviceAdapter` of the fence,
   * by shape): a microphone registered on a RUNNING production Core is served from this call on
   * exactly as one of the first list - by THIS adapter, so that there is still ONE configuration
   * writer and one allocation per card. Every open, pre-check and listing of it then reads its
   * STORED row and a fresh card listing and finds its card by serial or port, as for any other.
   * NOTHING OF THE DEVICE IS READ OR KEPT HERE but its entry: an admission lists no card, writes no
   * configuration, makes no pipe and starts no program.
   *
   * It takes the entry form of the first list. Refused, by a `CaptureAdapterError` and with nothing
   * changed: what is no entry or names no id (`CAPTURE_DEVICE_UNKNOWN`), a device of another class
   * or an id of another class (`CAPTURE_DEVICE_CLASS_MISMATCH`), an entry that states another
   * adapter kind (`CAPTURE_ADAPTER_KIND_NOT_ALLOWED`) or another source class
   * (`DEVELOPMENT_SOURCE_NOT_ALLOWED`). A microphone that is served already: nothing happens.
   */
  admitDevice(entry: CaptureDeviceEntry): void;
  /** The microphones admitted after the build, in the order they came. `devices` stays the first list. */
  admittedDevices(): readonly CaptureDeviceEntry[];
}

/** What the guard is started with: the helper program, then the helper's own list. The guard adds and reads nothing else. */
export function guardedArguments(helperProgram: string, helperArguments: readonly string[]): readonly string[] {
  return Object.freeze([helperProgram, ...helperArguments]);
}

interface Located {
  readonly stored: RegisteredAudioInput;
  readonly card: CaptureCard;
  readonly shared: SharedCaptureCard;
  readonly renamed: boolean;
}

interface Held {
  shared: SharedCaptureCard | null;
  stream: UsbAudioStream | null;
}

const abortedNow = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

export function createUsbAudioProductionAdapter(options: UsbAudioProductionOptions): UsbAudioProductionAdapter {
  const limits: UsbAudioLimits = { ...USB_AUDIO_LIMITS, ...options.limits };
  const door = options.door ?? startProductionProcess;
  const inspect = options.inspect ?? inspectProgram;
  const files = options.files ?? createPipeFiles();
  const { timers, helperProgram, guardProgram, runDir } = options;
  const devices: readonly CaptureDeviceEntry[] = Object.freeze([...options.devices]);
  const transport = MIC_TRANSPORTS.PCM_FIFO;
  /** The microphones whose pipe is prepared or whose helper runs. Claimed before the first await of `open`. */
  const held = new Map<string, Held>();
  const processes = new Map<string, ProductionProcess>();

  /** Row 85d: the microphones admitted after the build. */
  const admittedLater: CaptureDeviceEntry[] = [];
  /** Every microphone this adapter serves NOW: the first list, then the later ones. */
  const servedDevices = (): readonly CaptureDeviceEntry[] => [...devices, ...admittedLater];

  const served = (inputId: string): void => {
    if (!servedDevices().some((entry) => entry.id === inputId)) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
  };

  /** Row 85d: see `UsbAudioProductionAdapter.admitDevice`. Every refusal stands before the one change. */
  function admitDevice(entry: CaptureDeviceEntry): void {
    const given = entry as unknown as Readonly<Record<string, unknown>> | null;
    if (typeof given !== 'object' || given === null || typeof given['id'] !== 'string') throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    const id = given['id'];
    if (given['deviceClass'] !== 'MIC' || !MIC_ID.test(id)) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH);
    // An entry states neither; a descriptor does. Either one that is not this adapter's is another device than the one it serves.
    if (Object.hasOwn(given, 'adapterKind') && given['adapterKind'] !== CaptureAdapterKind.USB_AUDIO) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_KIND_NOT_ALLOWED);
    if (Object.hasOwn(given, 'sourceClass') && given['sourceClass'] !== sourceClassOf(CaptureAdapterKind.USB_AUDIO)) throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED);
    const capabilities = given['capabilities'];
    const profiles = given['profiles'];
    // The entry of a microphone: one capability, no media profile (profiles are a camera's).
    if (typeof given['label'] !== 'string' || !Array.isArray(capabilities) || capabilities.length !== 1 || capabilities[0] !== 'AUDIO' || !Array.isArray(profiles) || profiles.length !== 0) {
      throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH);
    }
    if (servedDevices().some((known) => known.id === id)) return;
    admittedLater.push(Object.freeze({ id, deviceClass: 'MIC' as const, label: given['label'], capabilities: Object.freeze(['AUDIO'] as const), profiles: Object.freeze([]) }));
  }

  const notice = (code: UsbAudioNoticeCode, deviceId: string): void => {
    try {
      options.onNotice?.(Object.freeze({ code, deviceId }));
    } catch {
      // An observer never changes what the adapter does.
    }
  };

  /** Both programs are vouched for before either is started, at the open and again at the start. */
  function assertPrograms(deviceId: string): void {
    const helper = helperProgramRefusal(inspect(helperProgram));
    if (helper !== null) throw new UsbAudioError(UsbAudioRefusal.PROGRAM_REFUSED, deviceId, `HELPER_${helper}`);
    const guard = helperProgramRefusal(inspect(guardProgram));
    if (guard !== null) throw new UsbAudioError(UsbAudioRefusal.PROGRAM_REFUSED, deviceId, `GUARD_${guard}`);
  }

  async function listNow(deviceId: string | null): Promise<CardListing> {
    try {
      return await options.cards.list();
    } catch (error) {
      throw new UsbAudioError(UsbAudioRefusal.LISTING_FAILED, deviceId, detailOf(error));
    }
  }

  async function storedRow(deviceId: string): Promise<RegisteredAudioInput> {
    let row: RegisteredAudioInput | null;
    try {
      row = await options.registered(deviceId);
    } catch (error) {
      throw new UsbAudioError(UsbAudioRefusal.INPUT_NOT_REGISTERED, deviceId, detailOf(error));
    }
    if (!isRegisteredAudioInput(row) || row.deviceId !== deviceId) throw new UsbAudioError(UsbAudioRefusal.INPUT_NOT_REGISTERED, deviceId);
    return row;
  }

  /** The stored row matched to a card of `listing`, with every refusal that needs no device. */
  function locateIn(listing: CardListing, stored: RegisteredAudioInput): Located {
    const found = identifyRegisteredCard(listing, stored);
    if (!found.ok) throw new UsbAudioError(found.refusal, stored.deviceId, found.detail);
    const { card } = found;
    if (card.factsSource === CardFactsSource.ASSUMED) throw new UsbAudioError(UsbAudioRefusal.CARD_FACTS_UNKNOWN, stored.deviceId);
    if (stored.inputNumber > card.channelCount) throw new AudioInputBeyondCardError(stored.deviceId);
    let shared: SharedCaptureCard;
    try {
      shared = sharedCaptureOfCard(card, transport.sampleRateHz);
    } catch (error) {
      throw new UsbAudioError(UsbAudioRefusal.CONFIG_REFUSED, stored.deviceId, detailOf(error));
    }
    // The helper asks the shared capture for the transport's rate. A card that runs at another one would be resampled by the sound layer.
    if (shared.rateHz !== transport.sampleRateHz) throw new UsbAudioError(UsbAudioRefusal.CARD_RATE_UNSUPPORTED, stored.deviceId);
    return { stored, card, shared, renamed: found.renamed };
  }

  /** The stored row and a FRESH listing: every call lists the cards again. */
  async function locate(deviceId: string): Promise<Located> {
    const stored = await storedRow(deviceId);
    return locateIn(await listNow(deviceId), stored);
  }

  /** One writer at a time: the configuration is ONE file, and two starts of a session come in the same turn. */
  let writing: Promise<unknown> = Promise.resolve();
  function writeConfig(deviceId: string, extra: SharedCaptureCard | null): Promise<AlsaConfigResult> {
    const run = writing.then(async () => {
      // One entry per card and device: the cards of every input that is held, and the one asked for.
      const entries = new Map<string, SharedCaptureCard>();
      for (const entry of held.values()) if (entry.shared !== null) entries.set(`${String(entry.shared.cardIndex)}:${String(entry.shared.deviceIndex)}`, entry.shared);
      if (extra !== null) entries.set(`${String(extra.cardIndex)}:${String(extra.deviceIndex)}`, extra);
      try {
        return await ensureAlsaConfig(options.configWriter, runDir, [...entries.values()]);
      } catch (error) {
        throw new UsbAudioError(UsbAudioRefusal.CONFIG_REFUSED, deviceId, detailOf(error));
      }
    });
    writing = run.catch(() => undefined);
    return run;
  }

  /** The production door in the shape the pipe maker asks for: a short program, no start message, the given environment. */
  const shortDoor = (environment: ProductionEnvironment): HelperDoor => (asked) => {
    const running = door({ command: asked.command, args: asked.args, env: environment, message: null, timers });
    return {
      get pid() {
        return running.pid;
      },
      ended: running.ended,
      alive: () => running.alive(),
      kill: (signal) => running.kill(signal),
    };
  };

  /**
   * The ONE way a guarded program is stopped: the end of the guard's input first (its order to end
   * its child), a signal only when that was not obeyed. A guard that is killed outright could
   * leave its child behind.
   */
  async function stop(running: ProductionProcess, deviceId: string): Promise<void> {
    if (!running.alive()) return;
    running.endInput();
    const cancelTerm = timers.after(limits.stopGraceMs, () => {
      notice(UsbAudioNoticeCode.HELPER_SIGNALLED, deviceId);
      running.kill('SIGTERM');
    });
    const cancelKill = timers.after(limits.stopGraceMs + limits.killGraceMs, () => running.kill('SIGKILL'));
    await running.ended;
    cancelTerm();
    cancelKill();
  }

  async function makePipe(sessionId: string, deviceId: string): Promise<string> {
    try {
      return await preparePipe({ runDir, sessionId, deviceId, files, door: shortDoor({}), timers, inspector: inspect });
    } catch (error) {
      throw new UsbAudioError(UsbAudioRefusal.PIPE_REFUSED, deviceId, detailOf(error));
    }
  }

  async function open(inputId: string, target: AudioOpenTarget): Promise<UsbAudioStream> {
    served(inputId);
    if (target.signal.aborted) throw new UsbAudioError(UsbAudioRefusal.ABORTED, inputId);
    if (held.has(inputId)) throw new UsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId);
    const entry: Held = { shared: null, stream: null };
    held.set(inputId, entry);

    let pipePath: string | null = null;
    let located: Located;
    let config: AlsaConfigResult;
    let helperArguments: readonly string[];
    try {
      assertPrograms(inputId);
      located = await locate(inputId);
      entry.shared = located.shared;
      config = await writeConfig(inputId, null);
      if (target.signal.aborted) throw new UsbAudioError(UsbAudioRefusal.ABORTED, inputId);
      pipePath = await makePipe(target.sessionId, inputId);
      try {
        // INTEGERS ONLY: three numbers of the live listing, and the registered input number as an index of the table.
        helperArguments = linuxMicPushArguments({
          cardIndex: located.card.cardIndex,
          deviceIndex: located.card.deviceIndex,
          channelCount: located.card.channelCount,
          inputNumber: located.stored.inputNumber,
          pipePath,
          deviceId: inputId,
        });
      } catch (error) {
        if (error instanceof AudioInputBeyondCardError) throw error;
        throw new UsbAudioError(UsbAudioRefusal.ARGUMENT_REFUSED, inputId, detailOf(error));
      }
    } catch (error) {
      if (pipePath !== null) removePipe(files, pipePath);
      held.delete(inputId);
      throw error;
    }
    if (located.renamed) notice(UsbAudioNoticeCode.CARD_RENAMED, inputId);
    if (located.card.channelCount !== located.stored.nativeChannels) notice(UsbAudioNoticeCode.CARD_CHANNELS_DIFFER, inputId);

    const path = pipePath;
    const environment: ProductionEnvironment = config.environment;
    const opened = located;
    let launched = false;
    let helper: ProductionProcess | null = null;
    let closing: Promise<void> | null = null;
    const listeners = new Set<(error: UsbAudioError) => void>();

    const stream: UsbAudioStream = {
      deviceId: inputId,
      input: Object.freeze({ kind: CaptureMicInputKind.PCM_FIFO, path }),
      transport,
      helperArguments,
      card: Object.freeze({
        cardIndex: opened.card.cardIndex,
        deviceIndex: opened.card.deviceIndex,
        channelCount: opened.card.channelCount,
        inputNumber: opened.stored.inputNumber,
        rateHz: opened.shared.rateHz,
        nativeFormat: opened.shared.format,
        sampleBits: Math.min(BITS_OF_FORMAT[opened.shared.format] ?? CAPTURE_BITS, CAPTURE_BITS),
        cardId: opened.card.cardId,
        usbId: opened.card.usbId,
        usbSerial: identityText(opened.card.usbSerial),
        usbPort: identityText(opened.card.usbPort),
        product: opened.card.product,
      }),

      started: () => launched,
      guardPid: () => helper?.pid ?? null,
      onLost(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },

      async start(signal) {
        if (closing !== null || abortedNow(signal)) throw new UsbAudioError(UsbAudioRefusal.ABORTED, inputId);
        if (launched) throw new UsbAudioError(UsbAudioRefusal.ALREADY_OPEN, inputId);
        launched = true;
        // The cards are listed again: time has passed since the open, and a card index is the number of one listing.
        // The stored row is matched AGAIN by serial, else by port path (row 200): a card swapped since the open is refused here, before the door is called.
        const now = await locate(inputId);
        const same =
          identityText(now.card.usbSerial) === identityText(opened.card.usbSerial) &&
          identityText(now.card.usbPort) === identityText(opened.card.usbPort) &&
          now.card.cardIndex === opened.card.cardIndex &&
          now.card.deviceIndex === opened.card.deviceIndex &&
          now.card.channelCount === opened.card.channelCount &&
          now.stored.inputNumber === opened.stored.inputNumber &&
          now.shared.rateHz === opened.shared.rateHz &&
          now.shared.format === opened.shared.format;
        if (!same) throw new UsbAudioError(UsbAudioRefusal.CARD_MOVED, inputId);
        assertPrograms(inputId);
        if (closing !== null || abortedNow(signal)) throw new UsbAudioError(UsbAudioRefusal.ABORTED, inputId);

        const watch = createDeliveryWatch('SAMPLE');
        const running = door({ command: guardProgram, args: guardedArguments(helperProgram, helperArguments), env: environment, message: null, timers, onOutput: (chunk) => watch.push(chunk) });
        helper = running;
        processes.set(inputId, running);
        void running.ended.then(() => {
          if (processes.get(inputId) === running) processes.delete(inputId);
        });
        try {
          await running.started;
        } catch (error) {
          await running.ended;
          throw new UsbAudioError(UsbAudioRefusal.HELPER_NOT_STARTED, inputId, detailOf(error));
        }

        // The bound of the first sample runs from the start of the helper.
        let starved = false;
        const cancelFirstSample = timers.after(limits.firstSampleMs, () => {
          if (watch.delivered() || !running.alive()) return;
          starved = true;
          void stop(running, inputId);
        });
        void running.ended.then(() => cancelFirstSample());

        // Whichever comes first: the helper ended, the settle time passed, the caller gave up.
        const first = await new Promise<'ENDED' | 'SETTLED' | 'ABORTED'>((resolve) => {
          const cancel = timers.after(limits.settleMs, () => resolve('SETTLED'));
          const onAbort = (): void => resolve('ABORTED');
          signal?.addEventListener('abort', onAbort, { once: true });
          void running.ended.then(() => {
            cancel();
            signal?.removeEventListener('abort', onAbort);
            resolve('ENDED');
          });
        });

        if (first === 'ABORTED') {
          await stop(running, inputId);
          throw new UsbAudioError(UsbAudioRefusal.ABORTED, inputId);
        }
        if (first === 'ENDED') {
          const exit = await running.ended;
          if (closing !== null) throw new UsbAudioError(UsbAudioRefusal.ABORTED, inputId);
          throw new UsbAudioError(exit.spawnFailed ? UsbAudioRefusal.HELPER_NOT_STARTED : UsbAudioRefusal.HELPER_ENDED_AT_START, inputId, detailOfExit(exit));
        }

        // It lives: the input is open. From here an end that nobody asked for is a lost microphone.
        void running.ended.then((exit) => {
          if (closing !== null) return;
          const lost = new UsbAudioError(starved ? UsbAudioRefusal.NO_SAMPLE : UsbAudioRefusal.HELPER_EXITED, inputId, detailOfExit(exit));
          for (const listener of listeners) {
            try {
              listener(lost);
            } catch {
              // A listener never stops the others from being told.
            }
          }
        });
      },

      close() {
        closing ??= (async () => {
          if (helper !== null) await stop(helper, inputId);
          processes.delete(inputId);
          if (!removePipe(files, path)) notice(UsbAudioNoticeCode.PIPE_NOT_REMOVED, inputId);
          held.delete(inputId);
          listeners.clear();
        })();
        return closing;
      },
    };
    const frozen = Object.freeze(stream);
    entry.stream = frozen;
    frozen.onLost((error) => options.onSourceLost?.(inputId, error));
    return frozen;
  }

  /** A guarded program that ends by itself, held to a bound: stopped through the guard's input when it outlives it or the caller gives up. */
  async function runShort(deviceId: string, args: readonly string[], environment: ProductionEnvironment, signal: AbortSignal | undefined): Promise<{ readonly exit: ProductionExit; readonly timedOut: boolean; readonly aborted: boolean }> {
    const running = door({ command: guardProgram, args, env: environment, message: null, timers });
    let timedOut = false;
    let aborted = false;
    const cancel = timers.after(limits.precheckTimeoutMs, () => {
      timedOut = true;
      void stop(running, deviceId);
    });
    const onAbort = (): void => {
      aborted = true;
      void stop(running, deviceId);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const exit = await running.ended;
    cancel();
    signal?.removeEventListener('abort', onAbort);
    return { exit, timedOut, aborted };
  }

  async function precheck(inputId: string, signal?: AbortSignal): Promise<UsbAudioError | AudioInputBeyondCardError | null> {
    served(inputId);
    try {
      if (abortedNow(signal)) return new UsbAudioError(UsbAudioRefusal.ABORTED, inputId);
      assertPrograms(inputId);
      const located = await locate(inputId);
      const config = await writeConfig(inputId, located.shared);
      let args: readonly string[];
      try {
        // INTEGERS ONLY, of the live listing: all channels of the card are opened, nothing is selected and nothing written.
        args = linuxMicPrecheckArguments({ cardIndex: located.card.cardIndex, deviceIndex: located.card.deviceIndex, channelCount: located.card.channelCount });
      } catch (error) {
        return new UsbAudioError(UsbAudioRefusal.ARGUMENT_REFUSED, inputId, detailOf(error));
      }
      if (abortedNow(signal)) return new UsbAudioError(UsbAudioRefusal.ABORTED, inputId);
      const run = await runShort(inputId, guardedArguments(helperProgram, args), config.environment, signal);
      if (run.aborted) return new UsbAudioError(UsbAudioRefusal.ABORTED, inputId);
      if (run.timedOut) return new UsbAudioError(UsbAudioRefusal.PRECHECK_TIMEOUT, inputId);
      if (run.exit.spawnFailed) return new UsbAudioError(UsbAudioRefusal.HELPER_NOT_STARTED, inputId, detailOfExit(run.exit));
      return run.exit.exitCode === 0 ? null : new UsbAudioError(UsbAudioRefusal.HELPER_ENDED_AT_START, inputId, detailOfExit(run.exit));
    } catch (error) {
      if (error instanceof UsbAudioError || error instanceof AudioInputBeyondCardError) return error;
      throw error;
    }
  }

  return {
    seam: 'AUDIO',
    kind: CaptureAdapterKind.USB_AUDIO,
    devices,
    hasOpener: true,

    /** One listing for all registered microphones. It opens no device and starts no helper. */
    async enumerate(): Promise<AudioInputDescriptor[]> {
      let listing: CardListing | null = null;
      try {
        listing = await listNow(null);
      } catch (error) {
        if (!(error instanceof UsbAudioError)) throw error;
      }
      const answers: AudioInputDescriptor[] = [];
      for (const entry of servedDevices()) {
        let errorCode: AudioInputErrorCode | null = listing === null ? AudioInputErrorCode.OPEN_FAILED : null;
        if (listing !== null) {
          try {
            locateIn(listing, await storedRow(entry.id));
          } catch (error) {
            if (error instanceof UsbAudioError) errorCode = error.wireCode;
            else if (error instanceof AudioInputBeyondCardError) errorCode = AudioInputErrorCode.OPEN_FAILED;
            else throw error;
          }
        }
        answers.push({ inputId: entry.id, present: errorCode === null, errorCode });
      }
      return answers;
    },

    open,

    async level(inputId: string): Promise<number | null> {
      served(inputId);
      const reading = options.level?.(inputId) ?? null;
      return typeof reading === 'number' && Number.isFinite(reading) ? Math.min(reading, 0) : null;
    },

    precheck,

    sourceFacts(inputId: string): UsbAudioSourceStatement | null {
      const facts = held.get(inputId)?.stream?.card;
      if (facts === undefined) return null;
      return Object.freeze({
        product: facts.product,
        usbId: facts.usbId,
        usbSerial: facts.usbSerial,
        usbPort: facts.usbPort,
        cardId: facts.cardId,
        cardDevice: facts.deviceIndex,
        inputNumber: facts.inputNumber,
        nativeChannels: facts.channelCount,
        sampleRateHz: facts.rateHz,
        sampleBits: facts.sampleBits,
      });
    },

    openSources: () => [...held.keys()].sort(),
    livePids: () => new Set([...processes.values()].map((running) => running.pid).filter((pid): pid is number => pid !== null)),
    async closeAll() {
      await Promise.all([...held.values()].map((entry) => entry.stream?.close()));
    },
    admitDevice,
    admittedDevices: () => Object.freeze([...admittedLater]),
  };
}
