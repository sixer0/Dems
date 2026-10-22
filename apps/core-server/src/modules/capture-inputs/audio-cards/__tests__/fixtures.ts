// Fixed listing texts for the tests of the microphone registration module (task 4 row 70).
//
// THE DOUBLE. No Linux host and no sound card exist here. The enumerator is the REAL one of row 64
// (`createCardEnumerator`), fed by a source that is a table of fixed texts in the forms a Linux
// host prints (the list of capture hardware, the USB id file and the stream file of a card).
// Every name is synthetic. What a real interface prints is proven on hardware (`9A/H-07`).
import { createCardEnumerator, type CardEnumerator, type CardListingSource } from '../../../../capture/adapters';
import type { MicrophoneRegistrar } from '../service';

const HEADING = '**** List of CAPTURE Hardware Devices ****\n';
const listed = (cardIndex: number, cardId: string, name: string, deviceIndex = 0): string =>
  `card ${cardIndex}: ${cardId} [${name}], device ${deviceIndex}: USB Audio [USB Audio]\n  Subdevices: 1/1\n  Subdevice #0: subdevice #0\n`;
const capture = (format: string, channels: number, bits: number): string =>
  `Capture:\n  Status: Stop\n  Interface 1\n    Altset 1\n    Format: ${format}\n    Channels: ${channels}\n    Endpoint: 0x81 (1 IN) (ASYNC)\n    Rates: 44100, 48000\n    Data packet interval: 125 us\n    Bits: ${bits}\n\n`;
const usbStream = (product: string, port: string, body: string): string => `${product} at usb-${port}, high speed : USB Audio\n\n${body}`;

/** The texts of one host, by what the source is asked. */
export interface HostTexts {
  readonly list: string;
  readonly usbId?: Readonly<Record<number, string>>;
  /** Stream files by `card:device`. */
  readonly streams?: Readonly<Record<string, string>>;
  /** The serial of the USB device of a card, by card index, as the ONE line the kernel shows (task 4 row 199). A card left out states none. */
  readonly serials?: Readonly<Record<number, string>>;
}

export const DUO = { cardId: 'DemsDuo', product: 'DEMS Test Duo', usbId: 'fff0:0002', channels: 2 } as const;
export const SIX = { cardId: 'DemsSix', product: 'DEMS Test Six', usbId: 'fff0:0006', channels: 6 } as const;
/** A card that is not USB and states nothing: the listing GUESSES two channels (`ASSUMED`). */
export const ONBOARD = { cardId: 'Onboard', product: 'DEMS Test Onboard' } as const;

/** Two USB cards: a card of two inputs as card 1, a multi-input interface of six as card 2. */
export const TWO_CARDS: HostTexts = {
  list: HEADING + listed(1, DUO.cardId, DUO.product) + listed(2, SIX.cardId, SIX.product),
  usbId: { 1: `${DUO.usbId}\n`, 2: `${SIX.usbId}\n` },
  streams: {
    '1:0': usbStream(DUO.product, '0000:00:14.0-2', capture('S24_3LE', DUO.channels, 24)),
    '2:0': usbStream(SIX.product, '0000:00:14.0-3.1', capture('S32_LE', SIX.channels, 24)),
  },
};
/** The multi-input interface alone. */
export const ONE_INTERFACE: HostTexts = { list: HEADING + listed(2, SIX.cardId, SIX.product), usbId: { 2: `${SIX.usbId}\n` }, streams: { '2:0': TWO_CARDS.streams?.['2:0'] ?? '' } };
/** The same card id and device index, and another USB id behind them: another card took the place. */
export const INTERFACE_REPLACED: HostTexts = { ...ONE_INTERFACE, usbId: { 2: 'fff0:0099\n' } };
/** The port paths of the texts above and of the two below (task 4 row 156: the identity rule reads them). */
export const SIX_PORT = '0000:00:14.0-3.1';
export const OTHER_PORT = '0000:00:14.0-4';
/**
 * A CARD OF THE SAME PRODUCT ON ANOTHER PORT: the same card id, device index, USB id and product
 * as `ONE_INTERFACE`, and another port path. Nothing but the port tells it from the registered card.
 */
export const INTERFACE_ON_ANOTHER_PORT: HostTexts = { ...ONE_INTERFACE, streams: { '2:0': usbStream(SIX.product, OTHER_PORT, capture('S32_LE', SIX.channels, 24)) } };
/** The same card with a stream file that states NO port (the system offers none). */
export const INTERFACE_WITHOUT_PORT: HostTexts = { ...ONE_INTERFACE, streams: { '2:0': `${SIX.product} : USB Audio\n\n${capture('S32_LE', SIX.channels, 24)}` } };
/** The kernel's id of a second card of one product. */
export const SIX_SECOND_CARD_ID = `${SIX.cardId}_1`;
/** TWO CARDS OF ONE PRODUCT: the registered one on its port, and a second (card 3) on another port with the same USB id. */
export const TWO_OF_ONE_PRODUCT: HostTexts = {
  list: HEADING + listed(2, SIX.cardId, SIX.product) + listed(3, SIX_SECOND_CARD_ID, SIX.product),
  usbId: { 2: `${SIX.usbId}\n`, 3: `${SIX.usbId}\n` },
  streams: { '2:0': usbStream(SIX.product, SIX_PORT, capture('S32_LE', SIX.channels, 24)), '3:0': usbStream(SIX.product, OTHER_PORT, capture('S32_LE', SIX.channels, 24)) },
};
/** The same two with their ports EXCHANGED: behind the registered key now sits the other card. */
export const TWO_OF_ONE_PRODUCT_SWAPPED: HostTexts = {
  ...TWO_OF_ONE_PRODUCT,
  streams: { '2:0': usbStream(SIX.product, OTHER_PORT, capture('S32_LE', SIX.channels, 24)), '3:0': usbStream(SIX.product, SIX_PORT, capture('S32_LE', SIX.channels, 24)) },
};
// ── Task 4 row 199: the SERIAL of a card, and one model on two ports ───────────────────────────
/** The port path of the card of two inputs in `TWO_CARDS`. */
export const DUO_PORT = '0000:00:14.0-2';
/** Synthetic serials, in the closed form a stored serial has. */
export const SIX_SERIAL = 'DEMS-SN-0006A';
export const OTHER_SERIAL = 'DEMS-SN-0006B';
/** The multi-input interface WITH a serial, on its port. */
export const INTERFACE_WITH_SERIAL: HostTexts = { ...ONE_INTERFACE, serials: { 2: `${SIX_SERIAL}\n` } };
/** THE SAME UNIT moved to another socket: the serial is the stored one, the port path is another. */
export const INTERFACE_WITH_SERIAL_MOVED: HostTexts = { ...INTERFACE_ON_ANOTHER_PORT, serials: { 2: `${SIX_SERIAL}\n` } };
/** ANOTHER UNIT of the model on the SAME socket: USB id, product and port path are equal, the serial is another. */
export const INTERFACE_OTHER_UNIT_SAME_PORT: HostTexts = { ...ONE_INTERFACE, serials: { 2: `${OTHER_SERIAL}\n` } };
/** ANOTHER UNIT of the model on ANOTHER socket: nothing of the stored identity but the USB id. */
export const INTERFACE_OTHER_UNIT_ELSEWHERE: HostTexts = { ...INTERFACE_ON_ANOTHER_PORT, serials: { 2: `${OTHER_SERIAL}\n` } };
/** Two cards of one model that state the SAME serial (cheap cards do): the registered one on its port, a second on another. */
export const TWO_SHARING_A_SERIAL: HostTexts = { ...TWO_OF_ONE_PRODUCT, serials: { 2: `${SIX_SERIAL}\n`, 3: `${SIX_SERIAL}\n` } };
/** The same two with their ports exchanged. */
export const TWO_SHARING_A_SERIAL_SWAPPED: HostTexts = { ...TWO_OF_ONE_PRODUCT_SWAPPED, serials: { 2: `${SIX_SERIAL}\n`, 3: `${SIX_SERIAL}\n` } };
/** `TWO_CARDS` with a serial on the multi-input interface only: the card of two inputs states none. */
export const TWO_CARDS_ONE_SERIAL: HostTexts = { ...TWO_CARDS, serials: { 2: `${SIX_SERIAL}\n` } };
/** The same, the interface moved to another socket (its serial unchanged). */
export const TWO_CARDS_INTERFACE_MOVED: HostTexts = { ...TWO_CARDS_ONE_SERIAL, streams: { ...TWO_CARDS.streams, '2:0': usbStream(SIX.product, OTHER_PORT, capture('S32_LE', SIX.channels, 24)) } };
/** `TWO_CARDS` with the card of two inputs on ANOTHER socket: the same model, no serial, another port path. */
export const TWO_CARDS_DUO_ELSEWHERE: HostTexts = { ...TWO_CARDS_ONE_SERIAL, streams: { ...TWO_CARDS.streams, '1:0': usbStream(DUO.product, OTHER_PORT, capture('S24_3LE', DUO.channels, 24)) } };

// ── R-FLEX row 131: the USB id that could not be read (RM-A5, T-16) ─────────────────────────────
/** The multi-input interface with a USB id file outside the form: the listing answers its fixed replacement word. */
export const INTERFACE_UNREAD_USB_ID: HostTexts = { ...ONE_INTERFACE, usbId: { 2: 'not-a-usb-id\n' } };
/** The fixed word of a USB id the listing could not read (`CARD_USB_ID_REPLACEMENT`). */
export const UNREAD_USB_ID = '0000:0000';
/** The multi-input interface under ANOTHER kernel card id and on another port (a macOS move, `usb_<port>`): the same physical card. */
export const SIX_MOVED_CARD_ID = 'usb_14200000';
export const INTERFACE_MOVED_AND_RENAMED: HostTexts = {
  list: HEADING + listed(2, SIX_MOVED_CARD_ID, SIX.product),
  usbId: { 2: `${SIX.usbId}\n` },
  streams: { '2:0': usbStream(SIX.product, OTHER_PORT, capture('S32_LE', SIX.channels, 24)) },
};

/** The kernel id of the card of two inputs after a macOS-style move (`usb_<port>`). */
export const DUO_MOVED_CARD_ID = 'usb_14300000';
/** `TWO_CARDS_ONE_SERIAL` with the card of two inputs under ANOTHER kernel card id and on another port: the same physical card. */
export const TWO_CARDS_DUO_RENAMED: HostTexts = {
  list: HEADING + listed(1, DUO_MOVED_CARD_ID, DUO.product) + listed(2, SIX.cardId, SIX.product),
  usbId: TWO_CARDS.usbId,
  serials: { 2: `${SIX_SERIAL}\n` },
  streams: { ...TWO_CARDS.streams, '1:0': usbStream(DUO.product, OTHER_PORT, capture('S24_3LE', DUO.channels, 24)) },
};

// ── R-FLEX row 108: a third card no row holds, for two registrations begun together (T-11) ─────
export const TRIO = { cardId: 'DemsTrio', product: 'DEMS Test Trio', usbId: 'fff0:0003', channels: 3 } as const;
export const TRIO_PORT = '0000:00:14.0-5';
/** `TWO_CARDS` and a card of three inputs (card 3, no serial) that no microphone holds. */
export const THREE_CARDS: HostTexts = {
  list: TWO_CARDS.list + listed(3, TRIO.cardId, TRIO.product),
  usbId: { ...TWO_CARDS.usbId, 3: `${TRIO.usbId}\n` },
  streams: { ...TWO_CARDS.streams, '3:0': usbStream(TRIO.product, TRIO_PORT, capture('S24_3LE', TRIO.channels, 24)) },
};

/** A host without a sound card: the listing program prints its heading and nothing else. */
export const NO_CARD: HostTexts = { list: HEADING };
/** Text that is no listing at all, with a hostile entry line among it. */
export const MALFORMED: HostTexts = { list: 'arecord: device_list:274: no soundcards found...\ncard x: ;rm -rf / [‮evil], device zero\ncard 99: Too$Many [Name], device 0: A [B]\n\u0000\u0001garbage' };
/** A card that is not USB, with no stream file and no parameter dump. */
export const ONBOARD_ONLY: HostTexts = { list: HEADING + listed(0, ONBOARD.cardId, ONBOARD.product) };

export interface FakeHost {
  readonly enumerator: CardEnumerator;
  /** Puts another host in the place of the current one: the next listing reads it. */
  use(texts: HostTexts): void;
  /** Makes the next reading of the list fail with this error, once. */
  failOnce(error: Error): void;
  /** Makes the next reading of the list wait until the returned function is called. */
  holdOnce(): () => void;
  /** How often the list of capture hardware was read. */
  listings(): number;
}

/** The real enumerator over a table of fixed texts. Every argument of the source is an integer. */
export function fakeHost(initial: HostTexts): FakeHost {
  let texts = initial;
  let failure: Error | null = null;
  let held: Promise<void> | null = null;
  let listings = 0;
  const source: CardListingSource = {
    async captureDevices() {
      listings += 1;
      if (held !== null) {
        const waiting = held;
        held = null;
        await waiting;
      }
      if (failure !== null) {
        const error = failure;
        failure = null;
        throw error;
      }
      return texts.list;
    },
    presentCards: async () => null,
    usbId: async (cardIndex) => texts.usbId?.[cardIndex] ?? null,
    usbSerial: async (cardIndex) => texts.serials?.[cardIndex] ?? null,
    stream: async (cardIndex, deviceIndex) => texts.streams?.[`${cardIndex}:${deviceIndex}`] ?? null,
  };
  return {
    enumerator: createCardEnumerator(source),
    use: (next) => {
      texts = next;
    },
    failOnce: (error) => {
      failure = error;
    },
    holdOnce() {
      let release = (): void => {};
      held = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    listings: () => listings,
  };
}

// ── THE STAND-IN REGISTRAR (test support only; the product has none until the engine can add a
// microphone): the registry row with the unit's own connection, as the runtime role.
// The adapter kind and the class are literals of the statement; the id is the next free MIC-nn.
export const standInRegistrar: MicrophoneRegistrar = {
  async register(unit, device) {
    const { rows } = await unit.db.query<{ id: string }>(
      "INSERT INTO public.capture_devices (id, kind, transport, model, enabled, last_seen_at, adapter_kind) SELECT 'MIC-' || lpad((COALESCE(max(substring(d.id from '^MIC-([0-9]+)$')::int), 0) + 1)::text, 2, '0'), 'MIC', 'USB', $1::text, true, $2::bigint, 'USB_AUDIO' FROM public.capture_devices d RETURNING id",
      [device.model, device.at],
    );
    return rows[0]?.id ?? '';
  },
  async reenable(unit, device) {
    await unit.db.query("UPDATE public.capture_devices SET enabled = true, model = $2, last_seen_at = $3 WHERE id = $1 AND kind = 'MIC' AND adapter_kind = 'USB_AUDIO'", [device.deviceId, device.model, device.at]);
  },
};

