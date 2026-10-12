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

