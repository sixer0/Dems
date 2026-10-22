// R-FLEX row 107 (spec masterplan/01_specs_rflex_audio.md §3 and §10 T-1, reconciled in
// masterplan/01_specs_rflex.md RF-A1, RF-A5; user answers Q96-03 (i)+(iii), Q96-09 "treat as no
// serial"). THE SHARED CASE TABLE of the USB audio identity rule.
//
// The rule has two functions that do not import each other (88 D-A1.5): the runtime
// `identifyRegisteredCard` (capture/adapters/audio/usb-audio-production.ts) and the registration /
// listing `matchStoredCard` (modules/capture-inputs/audio-cards/service.ts). Both are pinned to the
// outcomes of THIS table, so they cannot drift apart. The rule: the USB id plus the serial where
// the card states one, else any unit of the model. The stored port is information only: it is
// compared solely as the tie-break of two units that state one serial. There is no port lock.
//
// Data only: no import, so a test of any folder may read it. The words are the existing values of
// `UsbAudioRefusal`, `CardMismatch` and `StoredCardMatch`, written as text.

/** One live unit of a listing, at device index 0. `usbId` null: a card that is not USB. */
export interface IdentityCaseUnit {
  readonly cardId: string;
  readonly usbId: string | null;
  readonly usbSerial: string | null;
  readonly usbPort: string | null;
}

/** The stored identity of the registered input (`capture_audio_inputs`), at device index 0. */
export interface IdentityCaseStored {
  readonly cardId: string;
  readonly usbId: string | null;
  readonly usbSerial: string | null;
  readonly usbPort: string | null;
}

/** What `identifyRegisteredCard` answers: the unit found (index into `live`), or the refusal value and its detail word. */
export type IdentityCaseRuntime =
  | { readonly ok: true; readonly unit: number; readonly renamed: boolean }
  | { readonly ok: false; readonly refusal: string; readonly detail: string | null };

/** What `matchStoredCard` answers for the candidate `live[unit]` within the whole listing; null where the registration has no case (no candidate, or a stored USB id that could not be read). */
export interface IdentityCaseRegistration {
  readonly unit: number;
  readonly match: string;
}

export interface StoredCardIdentityCase {
  readonly name: string;
  readonly stored: IdentityCaseStored;
  readonly live: readonly IdentityCaseUnit[];
  readonly runtime: IdentityCaseRuntime;
  readonly registration: IdentityCaseRegistration | null;
}

/** The bench microphone (HANMUS "BOMGE USB AUDIO", 03_deployment_check D2): states no serial, registered on port 1-1. */
export const BOMGE_USB_ID = '3347:2430';
const BOMGE = 'BOMGE';
const MODEL = '1a2b:0008';
const OTHER_MODEL = '3c4d:2902';
const PORT_A = '1-1';
const PORT_B = '1-2';
const PORT_C = '2-4';
/** The fixed word of a USB id that could not be read (`CARD_USB_ID_REPLACEMENT`). */
const UNREAD_USB_ID = '0000:0000';

const unit = (cardId: string, usbId: string | null, usbSerial: string | null, usbPort: string | null): IdentityCaseUnit => ({ cardId, usbId, usbSerial, usbPort });
const found = (index: number, renamed = false): IdentityCaseRuntime => ({ ok: true, unit: index, renamed });
const refused = (refusal: string, detail: string | null = null): IdentityCaseRuntime => ({ ok: false, refusal, detail });
const reg = (index: number, match: string): IdentityCaseRegistration => ({ unit: index, match });

/** Every row of the §3 rule table, in its order. No case names a port difference as a refusal. */
export const STORED_CARD_IDENTITY_CASES: readonly StoredCardIdentityCase[] = Object.freeze([
  {
    name: 'not USB: the one card under the stored kernel name',
    stored: { cardId: 'PCH', usbId: null, usbSerial: null, usbPort: null },
    live: [unit('PCH', null, null, null)],
    runtime: found(0),
    registration: reg(0, 'SAME_CARD'),
  },
  {
    name: 'not USB: a USB card under the stored kernel name is another card',
    stored: { cardId: 'PCH', usbId: null, usbSerial: null, usbPort: null },
    live: [unit('PCH', MODEL, null, PORT_A)],
    runtime: refused('AUDIO_CARD_CHANGED'),
    registration: reg(0, 'USB_ID_DIFFERS'),
  },
  {
    name: 'stored USB id is the word of an unread id: unidentified',
    stored: { cardId: 'Octo', usbId: UNREAD_USB_ID, usbSerial: null, usbPort: PORT_A },
    live: [unit('Octo', MODEL, null, PORT_A)],
    runtime: refused('AUDIO_CARD_UNIDENTIFIED'),
    registration: null,
  },
  {
    name: 'stored: neither serial nor port (Q96-09): read as "no serial", any serial-less unit of the model',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: null, usbPort: null },
    live: [unit('Octo', MODEL, null, PORT_B)],
    runtime: found(0),
    registration: reg(0, 'SAME_CARD'),
  },
  {
    name: 'serial stored: the one unit that states it, on another port (moved)',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: 'SN-A', usbPort: PORT_A },
    live: [unit('Octo', MODEL, 'SN-A', PORT_C)],
    runtime: found(0),
    registration: reg(0, 'SAME_CARD'),
  },
  {
    name: 'serial stored: two units state it, the stored port is the tie-break',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: 'SN-A', usbPort: PORT_A },
    live: [unit('Octo_1', MODEL, 'SN-A', PORT_C), unit('Octo', MODEL, 'SN-A', PORT_A)],
    runtime: found(1),
    registration: reg(1, 'SAME_CARD'),
  },
  {
    name: 'serial stored: two units state it, neither on the stored port: not tellable',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: 'SN-A', usbPort: PORT_A },
    live: [unit('Octo', MODEL, 'SN-A', PORT_B), unit('Octo_1', MODEL, 'SN-A', PORT_C)],
    runtime: refused('AUDIO_CARD_AMBIGUOUS', 'SERIAL_SHARED'),
    registration: reg(0, 'NOT_TELLABLE'),
  },
  {
    name: 'serial stored: no unit states it (another serial on the stored port)',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: 'SN-A', usbPort: PORT_A },
    live: [unit('Octo', MODEL, 'SN-B', PORT_A)],
    runtime: refused('AUDIO_CARD_CHANGED', 'SERIAL_DIFFERS'),
    registration: reg(0, 'SERIAL_DIFFERS'),
  },
  {
    name: 'BOMGE: no serial stored, registered on port 1-1, moved to another port: opens (no port lock)',
    stored: { cardId: BOMGE, usbId: BOMGE_USB_ID, usbSerial: null, usbPort: PORT_A },
    live: [unit(BOMGE, BOMGE_USB_ID, null, PORT_B)],
    runtime: found(0, false),
    registration: reg(0, 'SAME_CARD'),
  },
  {
    name: 'no serial stored: moved AND under another kernel name (macOS usb_<port>, renamed Linux card)',
    stored: { cardId: 'usb_14100000', usbId: BOMGE_USB_ID, usbSerial: null, usbPort: PORT_A },
    live: [unit('usb_14200000', BOMGE_USB_ID, null, PORT_C)],
    runtime: found(0, true),
    registration: reg(0, 'SAME_CARD'),
  },
  {
    name: 'no serial stored: the only unit of the model states a serial',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: null, usbPort: PORT_A },
    live: [unit('Octo', MODEL, 'SN-NEW', PORT_A)],
    runtime: refused('AUDIO_CARD_CHANGED', 'SERIAL_DIFFERS'),
    registration: reg(0, 'SERIAL_DIFFERS'),
  },
  {
    name: 'no serial stored: two serial-less units of the model (AU-R2): shared, not opened',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: null, usbPort: PORT_A },
    live: [unit('Octo', MODEL, null, PORT_A), unit('Octo_1', MODEL, null, PORT_B)],
    runtime: refused('AUDIO_CARD_AMBIGUOUS', 'MODEL_SHARED'),
    registration: reg(0, 'NOT_TELLABLE'),
  },
  {
    name: 'no serial stored: one serial-less unit beside a unit that states a serial: the serial-less one',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: null, usbPort: PORT_A },
    live: [unit('Octo', MODEL, 'SN-B', PORT_A), unit('Octo_1', MODEL, null, PORT_C)],
    runtime: found(1, true),
    registration: reg(1, 'SAME_CARD'),
  },
  {
    name: 'no unit of the USB id; another model under the stored kernel name',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: null, usbPort: PORT_A },
    live: [unit('Octo', OTHER_MODEL, null, PORT_A)],
    runtime: refused('AUDIO_CARD_CHANGED', 'USB_ID_DIFFERS'),
    registration: reg(0, 'USB_ID_DIFFERS'),
  },
  {
    name: 'no unit of the USB id and nothing under the stored kernel name: absent',
    stored: { cardId: 'Octo', usbId: MODEL, usbSerial: 'SN-A', usbPort: PORT_A },
    live: [],
    runtime: refused('AUDIO_CARD_ABSENT'),
    registration: null,
  },
]);
