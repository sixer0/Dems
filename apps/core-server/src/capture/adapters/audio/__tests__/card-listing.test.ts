// The card listing parser (task 4 blueprint row 64, WP-07a; addendum 4.2; AD-07 (1) (2); S3-2).
//
// THE DOUBLE. No Linux host and no sound card exist here. The source of the text is INJECTED: a
// table of fixed texts written in the forms input-av reads on its bench host (the list of capture
// hardware of the listing program, the card table and the stream files of the kernel, the
// hardware parameter dump). Every name in them is synthetic. What this proves is the PARSER: what
// it makes of a text, what it refuses, and that nothing a device announced leaves it unchecked.
// What a real interface prints is proven on hardware (record `implementation/064_card_listing.md`).
import { resolve } from 'node:path';
import { CAPTURE_AUDIO_CARD_TEXT_PATTERN, CaptureAudioCardSchema } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { WORKSPACE, occurrences, readTree } from '../../../../../test/static/scan';
import { AUDIO_INPUT_BEYOND_CARD, AudioInputBeyondCardError } from '../../types';
import * as unit from '../card-listing';
import {
  CARD_LISTING_STRING_FIELDS,
  CARD_TEXT_REPLACEMENT,
  CARD_USB_ID_REPLACEMENT,
  CardAllocationRefusal,
  CardFactsSource,
  CardStringKind,
  allocateCardInput,
  buildCaptureCard,
  cardListingText,
  cardSampleRate,
  cardText,
  cardUsbId,
  createCardEnumerator,
  findCaptureCard,
  parseCaptureDeviceList,
  parseHwParams,
  parsePresentCards,
  parseStreamCapture,
  parseUsbIdentity,
  selectCardInputs,
  type CaptureCard,
  type CardListingSource,
  type CardStringFieldsOf,
  type CardUsbIdentity,
  type ListedCaptureDevice,
  type PresentCard,
} from '../card-listing';

// ── Fixed texts, in the forms of a Linux host ─────────────────────────────────────────────────

const HEADING = '**** List of CAPTURE Hardware Devices ****\n';
const listed = (cardIndex: number, cardId: string, name: string, deviceIndex = 0, device = 'USB Audio'): string =>
  `card ${cardIndex}: ${cardId} [${name}], device ${deviceIndex}: ${device} [${device}]\n  Subdevices: 1/1\n  Subdevice #0: subdevice #0\n`;
const tableRow = (cardIndex: number, cardId: string, driver: string, name: string, long = name): string =>
  `${String(cardIndex).padStart(2)} [${cardId.padEnd(15)}]: ${driver} - ${name}\n                      ${long}\n`;

interface Altset {
  readonly format: string;
  readonly channels: number;
  readonly rates: string;
  readonly bits: number;
}
const side = (name: 'Playback' | 'Capture', sets: readonly Altset[]): string =>
  `${name}:\n  Status: Stop\n${sets
    .map(
      (set, at) =>
        `  Interface ${at + 1}\n    Altset ${at + 1}\n    Format: ${set.format}\n    Channels: ${set.channels}\n    Endpoint: 0x81 (1 IN) (ASYNC)\n    Rates: ${set.rates}\n    Data packet interval: 125 us\n    Bits: ${set.bits}\n`,
    )
    .join('')}\n`;
const usbStream = (product: string, port: string, ...sides: string[]): string => `${product} at usb-${port}, high speed : USB Audio\n\n${sides.join('')}`;

const DUO_STREAM = usbStream('DEMS Test Duo', '0000:00:14.0-2', side('Playback', [{ format: 'S24_3LE', channels: 2, rates: '44100, 48000', bits: 24 }]), side('Capture', [{ format: 'S24_3LE', channels: 2, rates: '44100, 48000', bits: 24 }]));
// A multi-input interface: four microphone sockets, and two further capture channels that carry
// the computer's own playback back in (the layout of the bench interface of input-av). The
// playback side has MORE channels than the capture side, to show it is not read.
const SIX_STREAM = usbStream(
  'DEMS Test Six',
  '0000:00:14.0-3.1',
  side('Playback', [{ format: 'S32_LE', channels: 8, rates: '44100, 48000, 88200, 96000', bits: 24 }]),
  side('Capture', [
    { format: 'S16_LE', channels: 2, rates: '44100, 48000', bits: 16 },
    { format: 'S32_LE', channels: 6, rates: '44100, 48000, 88200, 96000', bits: 24 },
  ]),
);
const ONBOARD_DUMP =
  'HW Params of device "hw:0,0":\n--------------------\nACCESS:  MMAP_INTERLEAVED RW_INTERLEAVED\nFORMAT:  S16_LE S32_LE\nSUBFORMAT:  STD\nSAMPLE_BITS: [16 32]\nFRAME_BITS: [32 64]\nCHANNELS: 2\nRATE: [44100 192000]\nPERIOD_TIME: (83 185760)\n--------------------\n';

interface HostTexts {
  readonly list: string;
  /** The card table; `null` for a host that has none; left out: no cross-check. */
  readonly table?: string | null;
  readonly usbId?: Readonly<Record<number, string>>;
  /** Stream files by `card:device`. */
  readonly streams?: Readonly<Record<string, string>>;
  /** Hardware parameter dumps by `card:device`; left out: the source has no such member. */
  readonly dumps?: Readonly<Record<string, string>>;
  /** The serial text of the USB device of a card, by card index (row 199); left out: the source has no such member. */
  readonly serials?: Readonly<Record<number, string>>;
}

function host(texts: HostTexts): { source: CardListingSource; calls: (readonly [string, ...unknown[]])[] } {
  const calls: (readonly [string, ...unknown[]])[] = [];
  const source: CardListingSource = {
    captureDevices: async () => (calls.push(['captureDevices']), texts.list),
    presentCards: async () => (calls.push(['presentCards']), texts.table ?? null),
    usbId: async (cardIndex) => (calls.push(['usbId', cardIndex]), texts.usbId?.[cardIndex] ?? null),
    stream: async (cardIndex, deviceIndex) => (calls.push(['stream', cardIndex, deviceIndex]), texts.streams?.[`${cardIndex}:${deviceIndex}`] ?? null),
    ...(texts.dumps === undefined ? {} : { hwParams: async (cardIndex: number, deviceIndex: number) => (calls.push(['hwParams', cardIndex, deviceIndex]), texts.dumps?.[`${cardIndex}:${deviceIndex}`] ?? null) }),
    ...(texts.serials === undefined ? {} : { usbSerial: async (cardIndex: number) => (calls.push(['usbSerial', cardIndex]), texts.serials?.[cardIndex] ?? null) }),
  };
  return { source, calls };
}
const listing = (texts: HostTexts) => createCardEnumerator(host(texts).source).list();

/** One USB card as card 1, with the product name under test. */
const oneUsbCard = (product: string, cardName = product, usbId = 'fff0:0001\n'): HostTexts => ({
  list: HEADING + listed(1, 'TestCard', cardName),
  usbId: { 1: usbId },
  streams: { '1:0': usbStream(product, '0000:00:14.0-2', side('Capture', [{ format: 'S32_LE', channels: 2, rates: '48000', bits: 24 }])) },
});

/** The answer of operation 98 for one card: the contract of row 63 must accept it. */
const asAnswer = (card: CaptureCard) => ({ cardId: card.cardId, deviceIndex: card.deviceIndex, usbId: card.usbId, product: card.product, channelCount: card.channelCount, sampleBits: [...card.sampleBits], registered: [], boundTo: null });

describe('fixed listings give the expected cards and inputs', () => {
  it('a card of two inputs: identity, native channel count, format, rates', async () => {
    const result = await listing({ list: HEADING + listed(1, 'Duo', 'DEMS Test Duo'), table: tableRow(1, 'Duo', 'USB-Audio', 'DEMS Test Duo', 'DEMS Test Duo at usb-0000:00:14.0-2, high speed'), usbId: { 1: 'fff0:0002\n' }, streams: { '1:0': DUO_STREAM } });
    expect(result).toEqual({
      truncated: false,
      skipped: 0,
      cards: [
        {
          cardIndex: 1,
          deviceIndex: 0,
          cardId: 'Duo',
          usb: true,
          usbId: 'fff0:0002',
          usbPort: '0000:00:14.0-2',
          usbSerial: null,
          product: 'DEMS Test Duo',
          channelCount: 2,
          factsSource: CardFactsSource.STREAM,
          formats: ['S24_3LE'],
          nativeFormat: 'S24_3LE',
          sampleBits: [24],
          ratesHz: [44_100, 48_000],
          rateRangeHz: null,
        },
      ],
    });
    const card = result.cards[0] as CaptureCard;
    expect(CaptureAudioCardSchema.safeParse(asAnswer(card)).success).toBe(true);
    // Both inputs in order on a card of two: taken as they are. One of the two: selected, not mixed.
    expect(selectCardInputs(card, [1, 2])).toEqual({ openChannels: 2, channelIndexes: [0, 1], whole: true });
    expect(selectCardInputs(card, [2])).toEqual({ openChannels: 2, channelIndexes: [1], whole: false });
    expect(selectCardInputs(card, [2, 1])).toEqual({ openChannels: 2, channelIndexes: [1, 0], whole: false });
  });

  it('an interface with more capture channels than sockets: ALL channels are opened, an input is selected; the playback side is not read', async () => {
    const result = await listing({ list: HEADING + listed(2, 'SixTest', 'DEMS Test Six'), usbId: { 2: 'fff0:0006\n' }, streams: { '2:0': SIX_STREAM } });
    const card = result.cards[0] as CaptureCard;
    // 6, the largest capture alternative; not 8 (playback), not 2 (the first alternative).
    expect(card).toMatchObject({ cardId: 'SixTest', channelCount: 6, formats: ['S32_LE', 'S16_LE'], nativeFormat: 'S32_LE', sampleBits: [16, 24], ratesHz: [44_100, 48_000, 88_200, 96_000], usbPort: '0000:00:14.0-3.1' });
    expect(CaptureAudioCardSchema.safeParse(asAnswer(card)).success).toBe(true);
    expect(selectCardInputs(card, [3])).toEqual({ openChannels: 6, channelIndexes: [2], whole: false });
    expect(selectCardInputs(card, [1, 2, 3, 4])).toEqual({ openChannels: 6, channelIndexes: [0, 1, 2, 3], whole: false });
    // The listing cannot tell a socket from a channel that carries playback back in: 5 and 6 are offered (unproven part, see the record).
    expect(selectCardInputs(card, [6]).channelIndexes).toEqual([5]);
    // The same file with the capture side first: still 6.
    const reversed = usbStream('DEMS Test Six', '0000:00:14.0-3.1', side('Capture', [{ format: 'S32_LE', channels: 6, rates: '48000', bits: 24 }]), side('Playback', [{ format: 'S32_LE', channels: 8, rates: '48000', bits: 24 }]));
    expect(parseStreamCapture(reversed)).toEqual({ channelCount: 6, formats: ['S32_LE'], sampleBits: [24], ratesHz: [48_000] });
    expect(parseStreamCapture(usbStream('DEMS Test Out', '1-1', side('Playback', [{ format: 'S16_LE', channels: 2, rates: '48000', bits: 16 }])))).toBeNull();
  });

  it('two USB cards and an onboard card at once: three entries in the order of the list, each with its own facts; a card is found only by its name', async () => {
    const texts: HostTexts = {
      list: HEADING + listed(0, 'Onboard', 'DEMS Onboard Analog', 0, 'Analog') + listed(1, 'Duo', 'DEMS Test Duo') + listed(2, 'SixTest', 'DEMS Test Six'),
      table: tableRow(0, 'Onboard', 'HDA-Intel', 'DEMS Onboard Analog', 'DEMS Onboard Analog at 0xf7f10000 irq 33') + tableRow(1, 'Duo', 'USB-Audio', 'DEMS Test Duo') + tableRow(2, 'SixTest', 'USB-Audio', 'DEMS Test Six'),
      usbId: { 1: 'fff0:0002\n', 2: 'fff0:0006\n' },
      streams: { '1:0': DUO_STREAM, '2:0': SIX_STREAM },
      dumps: { '0:0': ONBOARD_DUMP },
    };
    const { source, calls } = host(texts);
    const result = await createCardEnumerator(source).list();
    expect(result.cards.map((card) => [card.cardIndex, card.cardId, card.usb, card.usbId, card.channelCount, card.factsSource])).toEqual([
      [0, 'Onboard', false, null, 2, 'HW_PARAMS'],
      [1, 'Duo', true, 'fff0:0002', 2, 'STREAM'],
      [2, 'SixTest', true, 'fff0:0006', 6, 'STREAM'],
    ]);
    expect(result.skipped).toBe(0);
    for (const card of result.cards) expect(CaptureAudioCardSchema.safeParse(asAnswer(card)).success, card.cardId).toBe(true);
    // AD-07 (2): the source is asked with integers only.
    for (const [, ...args] of calls) expect(args.every((arg) => Number.isInteger(arg))).toBe(true);
    // The dump is asked for the card with no stream file only.
    expect(calls.filter(([name]) => name === 'hwParams')).toEqual([['hwParams', 0, 0]]);
    // Named by card id and device index, or nothing.
    expect(findCaptureCard(result, 'SixTest', 0)?.channelCount).toBe(6);
    expect(findCaptureCard(result, 'SixTest', 1)).toBeNull();
    expect(findCaptureCard(result, 'sixtest', 0)).toBeNull();
    expect(findCaptureCard(result, '', 0)).toBeNull();
    expect(findCaptureCard({ ...result, cards: [...result.cards, result.cards[1] as CaptureCard] }, 'Duo', 0)).toBeNull();
    // Two readings are two readings: nothing is kept.
    await createCardEnumerator(source).list();
    expect(calls.filter(([name]) => name === 'captureDevices')).toHaveLength(2);
  });

  it('an onboard card: no USB identity; facts from the dump, or marked ASSUMED when there is none or the device is busy', async () => {
    const list = HEADING + listed(0, 'Onboard', 'DEMS Onboard Analog', 0, 'Analog');
    const dumped = (await listing({ list, dumps: { '0:0': ONBOARD_DUMP } })).cards[0] as CaptureCard;
    expect(dumped).toEqual({ cardIndex: 0, deviceIndex: 0, cardId: 'Onboard', usb: false, usbId: null, usbPort: null, usbSerial: null, product: 'DEMS Onboard Analog', channelCount: 2, factsSource: 'HW_PARAMS', formats: ['S32_LE', 'S16_LE'], nativeFormat: 'S32_LE', sampleBits: [16, 32], ratesHz: [], rateRangeHz: { minHz: 44_100, maxHz: 192_000 } });
    const assumed = { channelCount: 2, factsSource: 'ASSUMED', formats: [], nativeFormat: 'S32_LE', sampleBits: [], ratesHz: [], rateRangeHz: null };
    expect((await listing({ list })).cards[0]).toMatchObject(assumed);
    expect((await listing({ list, dumps: { '0:0': 'arecord: main:831: audio open error: Device or resource busy\n' } })).cards[0]).toMatchObject(assumed);
    expect(parseHwParams('CHANNELS: [1 2]\nFORMAT:  S24_LE U8\nRATE: 48000\n')).toEqual({ channelCount: 2, formats: ['S24_LE'], rateRangeHz: { minHz: 48_000, maxHz: 48_000 } });
    expect(parseHwParams('FORMAT:  S16_LE\n')).toBeNull();
  });

  it('no card: an empty list, nothing skipped', async () => {
    for (const list of [HEADING, 'arecord: device_list:274: no soundcards found...\n', '', '\n\n']) {
      expect(await listing({ list, table: '--- no soundcards ---\n' }), JSON.stringify(list)).toEqual({ cards: [], truncated: false, skipped: 0 });
      expect(await listing({ list })).toEqual({ cards: [], truncated: false, skipped: 0 });
    }
    expect(parsePresentCards('--- no soundcards ---\n')).toEqual({ cards: [], skipped: 0 });
  });

  it('the card table: index, id and description; a card id of another form is refused', () => {
    const table = tableRow(0, 'Onboard', 'HDA-Intel', 'DEMS Onboard Analog') + tableRow(1, 'Duo', 'USB-Audio', 'DEMS Test Duo') + ' 2 [Bad-Id         ]: USB-Audio - X\n 3 [Duo            ]: USB-Audio - again\n 1 [Other          ]: USB-Audio - again\n';
    expect(parsePresentCards(table)).toEqual({
      cards: [
        { cardIndex: 0, cardId: 'Onboard', description: 'HDA-Intel - DEMS Onboard Analog' },
        { cardIndex: 1, cardId: 'Duo', description: 'USB-Audio - DEMS Test Duo' },
      ],
      skipped: 3,
    });
    expect(parsePresentCards(` 1 [Duo            ]: USB-Audio - ‮evil\n`).cards[0]?.description).toBe(CARD_TEXT_REPLACEMENT);
  });
});

describe('AD-07 (1): text a device announced is replaced when it fails the rule, never passed on', () => {
  const HOSTILE: readonly (readonly [string, string])[] = [
    ['a control character', 'DEMS\u0007Test'],
    ['a tab', 'DEMS\tTest'],
    ['an escape sequence', '\u001B[31mDEMS Test'],
    ['DEL', 'DEMS\u007FTest'],
    ['a character beyond ASCII', 'DEMS Tést'],
    ['a right-to-left override', 'DEMS ‮tset'],
    ['a left-to-right mark', 'DEMS‎Test'],
    ['a zero-width space', 'DEMS​Test'],
    ['a zero-width joiner', 'DEMS‍Test'],
    ['a byte order mark at the start', '﻿DEMS Test'],
    ['a no-break space at the end', 'DEMS Test '],
    ['65 characters', 'D'.repeat(65)],
    ['400 characters', 'DEMS '.repeat(80)],
    ['a tag', '<img src=x onerror=alert(1)>'],
    ['a closing tag', 'DEMS</td><script>'],
    ['spaces only', '    '],
    ['nothing', ''],
  ];

  it.each(HOSTILE)('%s in the product name', async (_label, product) => {
    const result = await listing(oneUsbCard(product));
    expect(result.cards).toHaveLength(1);
    const card = result.cards[0] as CaptureCard;
    expect(card.product).toBe(CARD_TEXT_REPLACEMENT);
    // The card itself is still listed, with its integers and its facts: only the text is replaced.
    expect(card).toMatchObject({ cardIndex: 1, deviceIndex: 0, cardId: 'TestCard', usbId: 'fff0:0001', usbPort: '0000:00:14.0-2', channelCount: 2 });
    expect(CaptureAudioCardSchema.safeParse(asAnswer(card)).success).toBe(true);
    // No character of the hostile text outside the rule is anywhere in the card.
    expect(/^[ -~]*$/.test(JSON.stringify(card))).toBe(true);
    expect(JSON.stringify(card).includes('<')).toBe(false);
  });

  it('a name inside the rule passes unchanged, also at the bound of 64 and with marks of real names', async () => {
    for (const product of ['DEMS Test Duo (2nd Gen)', 'D'.repeat(64), 'DEMS A&B USB-C Audio #2, rev. 1.0', "DEMS Operator's Desk Mic"]) {
      expect(((await listing(oneUsbCard(product))).cards[0] as CaptureCard).product, product).toBe(product);
      expect(cardText(`  ${product}  `)).toBe(product);
    }
    for (const value of [undefined, null, 7, {}, ['DEMS']]) expect(cardText(value)).toBe(CARD_TEXT_REPLACEMENT);
    expect(CAPTURE_AUDIO_CARD_TEXT_PATTERN.test(CARD_TEXT_REPLACEMENT)).toBe(true);
  });

  it('a product name that fails falls back to the card name of the list only when THAT passes the rule', async () => {
    expect(((await listing(oneUsbCard('DEMS\u0007Test', 'DEMS Test Card'))).cards[0] as CaptureCard).product).toBe('DEMS Test Card');
    expect(((await listing(oneUsbCard('DEMS\u0007Test', 'DEMS\u0007Test'))).cards[0] as CaptureCard).product).toBe(CARD_TEXT_REPLACEMENT);
  });

  it('a name cannot state a device index or a port of its own', async () => {
    // The name carries the mark of the list: the LAST mark of the line is the real one.
    const forgedIndex = await listing(oneUsbCard('DEMS Test', 'Evil], device 7: X [Y'));
    expect(forgedIndex.cards.map((card) => [card.cardIndex, card.deviceIndex])).toEqual([[1, 0]]);
    // The product carries the words of the port: the LAST ones of the line are the kernel's.
    const forgedPort = (await listing(oneUsbCard('Evil at usb-9999:99:99.9-9, low speed : X'))).cards[0] as CaptureCard;
    expect(forgedPort.usbPort).toBe('0000:00:14.0-2');
    expect(forgedPort.product).toBe('Evil at usb-9999:99:99.9-9, low speed : X');
    // A port of another form is not passed on.
    expect(parseUsbIdentity('fff0:0001\n', 'DEMS Test at usb-0000:00:14.0-2;rm, high speed : USB Audio\n')).toMatchObject({ usbPort: null, product: 'DEMS Test' });
    expect(parseUsbIdentity('fff0:0001\n', 'DEMS Test Profile Name\n')).toEqual({ usb: true, usbId: 'fff0:0001', usbPort: null, usbSerial: null, product: 'DEMS Test Profile Name' });
    // A line break in the name breaks the entry of the list: it is refused, not half read.
    expect(await listing(oneUsbCard('DEMS Test', 'DEMS\nTest'))).toEqual({ cards: [], truncated: false, skipped: 1 });
  });

  it('a USB id of another form gives the fixed id; the card stays a USB card', async () => {
    for (const usbId of ['ZZZZ:0001\n', 'FFF0:0001\n', 'fff0:0001 x\n', 'fff0:00011\n', 'fff00001\n', '\n', '', 'fff0:0001']) {
      const card = (await listing(oneUsbCard('DEMS Test', 'DEMS Test', usbId))).cards[0] as CaptureCard;
      expect([card.usb, card.usbId], JSON.stringify(usbId)).toEqual([true, CARD_USB_ID_REPLACEMENT]);
      expect(CaptureAudioCardSchema.safeParse(asAnswer(card)).success).toBe(true);
    }
    expect(cardUsbId('fff0:0001')).toBe('fff0:0001');
    for (const value of [undefined, null, 0xfff0, 'fff0:0001\n']) expect(cardUsbId(value)).toBe(CARD_USB_ID_REPLACEMENT);
    expect(parseUsbIdentity(null, DUO_STREAM)).toEqual({ usb: false, usbId: null, usbPort: null, usbSerial: null, product: null });
  });

  // Task 4 row 199 (AD-07 (4)): the listing states the serial of a USB card where the device has
  // one, and the port path of every USB card. THE DOUBLE: a table of fixed serial texts by card
  // index, in the form of the kernel's attribute (one line). No real host, no real card.
  it('row 199: the serial of a USB card - stated where the device has one, null where it has none, where the source offers none and for a card that is not USB', async () => {
    const texts: HostTexts = {
      list: HEADING + listed(0, 'Onboard', 'DEMS Onboard Analog', 0, 'Analog') + listed(1, 'Duo', 'DEMS Test Duo') + listed(2, 'Six', 'DEMS Test Six'),
      usbId: { 1: 'fff0:0002\n', 2: 'fff0:0006\n' },
      streams: { '1:0': DUO_STREAM, '2:0': SIX_STREAM },
      dumps: { '0:0': ONBOARD_DUMP },
      // Card 1 states a serial; card 2 states none (its device has no such attribute).
      serials: { 1: 'DEMS-SN-000123\n' },
    };
    const rig = host(texts);
    const cards = (await createCardEnumerator(rig.source).list()).cards;
    expect(cards.map((card) => [card.cardId, card.usbId, card.usbSerial, card.usbPort])).toEqual([
      ['Onboard', null, null, null],
      ['Duo', 'fff0:0002', 'DEMS-SN-000123', '0000:00:14.0-2'],
      ['Six', 'fff0:0006', null, '0000:00:14.0-3.1'],
    ]);
    // The serial is asked ONCE per USB card, by the card INDEX, and never for a card that is not USB.
    expect(rig.calls.filter(([name]) => name === 'usbSerial')).toEqual([['usbSerial', 1], ['usbSerial', 2]]);
    // A source WITHOUT the member (the source of before this row): every card is listed, none with a serial.
    const { serials: _none, ...without } = texts;
    expect((await listing(without)).cards.map((card) => card.usbSerial)).toEqual([null, null, null]);
  });

  it('row 199: TWO CARDS OF ONE MODEL on two ports are two entries that differ in the port path - and in the serial, where they state one', async () => {
    const twins = (serials: HostTexts['serials']): HostTexts => ({
      list: HEADING + listed(1, 'Six', 'DEMS Test Six') + listed(2, 'Six_1', 'DEMS Test Six'),
      usbId: { 1: 'fff0:0006\n', 2: 'fff0:0006\n' },
      streams: { '1:0': SIX_STREAM, '2:0': SIX_STREAM.replace('0000:00:14.0-3.1', '0000:00:14.0-4') },
      ...(serials === undefined ? {} : { serials }),
    });
    const identity = async (texts: HostTexts) => (await listing(texts)).cards.map((card) => [card.cardId, card.usbId, card.product, card.usbSerial, card.usbPort]);
    expect(await identity(twins({ 1: 'A1B2C3\n', 2: 'A1B2C4\n' }))).toEqual([
      ['Six', 'fff0:0006', 'DEMS Test Six', 'A1B2C3', '0000:00:14.0-3.1'],
      ['Six_1', 'fff0:0006', 'DEMS Test Six', 'A1B2C4', '0000:00:14.0-4'],
    ]);
    // Without a serial NOTHING but the port path tells the two apart: USB id and product are equal.
    expect(await identity(twins({}))).toEqual([
      ['Six', 'fff0:0006', 'DEMS Test Six', null, '0000:00:14.0-3.1'],
      ['Six_1', 'fff0:0006', 'DEMS Test Six', null, '0000:00:14.0-4'],
    ]);
  });

  it('row 199: a serial is device text - one closed rule, never cleaned or cut; a text outside it, a cut line and an empty one are NO serial, and the card is still listed', async () => {
    const serialOf = async (text: string) => ((await listing({ ...oneUsbCard('DEMS Test'), serials: { 1: text } })).cards[0] as CaptureCard).usbSerial;
    for (const good of ['0123456789AB', 'DEMS-SN_01.02:03', 'S'.repeat(64)]) expect(await serialOf(`${good}\n`), good).toBe(good);
    for (const bad of ['SN 0001\n', 'SN;reboot\n', '$(id)\n', '../../x\n', 'Série\n', '<b>1</b>\n', 'SN‮1\n', `${'S'.repeat(65)}\n`, '\n', '', 'CUT-LINE']) {
      const card = (await listing({ ...oneUsbCard('DEMS Test'), serials: { 1: bad } })).cards[0] as CaptureCard;
      expect([card.cardId, card.usbId, card.usbSerial, card.usbPort], JSON.stringify(bad)).toEqual(['TestCard', 'fff0:0001', null, '0000:00:14.0-2']);
    }
    // The parser alone, and the one function for the kind.
    expect(parseUsbIdentity('fff0:0001\n', DUO_STREAM, 'A1B2C3\n')).toEqual({ usb: true, usbId: 'fff0:0001', usbPort: '0000:00:14.0-2', usbSerial: 'A1B2C3', product: 'DEMS Test Duo' });
    expect(parseUsbIdentity(null, DUO_STREAM, 'A1B2C3\n').usbSerial).toBeNull();
    expect(cardListingText(CardStringKind.USB_SERIAL, 'A1B2C3')).toBe('A1B2C3');
    expect(cardListingText(CardStringKind.USB_SERIAL, 'A1 B2')).toBeNull();
  });

  it('a card id that is not of the kernel\'s form is not listed at all: it would be the key of a request', () => {
    const list = HEADING + listed(1, 'Bad-Id', 'X') + listed(2, 'a.b', 'X') + listed(3, 'A'.repeat(33), 'X') + listed(4, 'Café', 'X') + listed(5, 'Good_1', 'X');
    expect(parseCaptureDeviceList(list)).toEqual({ entries: [{ cardIndex: 5, deviceIndex: 0, cardId: 'Good_1', cardName: 'X' }], skipped: 4 });
  });
});

// Task 4 row 155 (AD-07 (1); S13-12 (b)): ONE function, and no string member of a result that does
// not pass it. Row 64 had three rule functions and one inline pattern, and `parseCaptureDeviceList`
// answered the card name of the list RAW. Three proofs: the function itself; the TYPE (a string
// member without a kind does not compile - checked by the workspace typecheck, with controls that
// must fail); and a WALK over every string of every result of hostile listings.
describe('row 155: every string of a card listing passes ONE function before it leaves the adapter', () => {
  const PRINTABLE = /^[ -~]*$/;
  /** Texts no rule of any kind admits: control, bidirectional and zero-width characters, a tag, over-long, empty, beyond ASCII. */
  const NEVER: readonly string[] = ['DEMS\u0007Test', 'DEMS\tTest', '\u001B[31mDEMS', 'DEMS\u007F', 'DEMS Tést', 'DEMS ‮tset', 'DEMS‎Test', 'DEMS​Test', 'DEMS‍Test', '﻿DEMS', 'DEMS ', '<img src=x onerror=alert(1)>', 'D'.repeat(65), 'D'.repeat(600), '', 'a\nb'];

  it('the one function, kind by kind: a text inside the rule is answered unchanged, anything else is the fixed replacement of the kind', () => {
    const inside: Record<CardStringKind, readonly string[]> = {
      NAME: ['DEMS Test Duo (2nd Gen)', 'D'.repeat(64), "DEMS Operator's Desk Mic", CARD_TEXT_REPLACEMENT],
      USB_ID: ['fff0:0001', '0a1b:2c3d', CARD_USB_ID_REPLACEMENT],
      CARD_ID: ['Duo', 'DEMS_TEST_A', 'A'.repeat(32), '0'],
      USB_PORT: ['0000:00:14.0-2', '0000:00:14.0-3.1', 'xhci-hcd.0.auto-1'.replace('auto', 'port')],
      USB_SERIAL: ['0123456789AB', 'DEMS-SN_01.02:03', 'S'.repeat(64)],
      FORMAT: ['S32_LE', 'S24_3LE', 'S24_LE', 'S16_LE'],
      FACTS_SOURCE: Object.values(CardFactsSource),
    };
    const replacement: Record<CardStringKind, string | null> = { NAME: CARD_TEXT_REPLACEMENT, USB_ID: CARD_USB_ID_REPLACEMENT, CARD_ID: null, USB_PORT: null, USB_SERIAL: null, FORMAT: null, FACTS_SOURCE: null };
    const outsideOf: Record<CardStringKind, readonly string[]> = {
      NAME: ['a<b', 'a>b'],
      USB_ID: ['FFF0:0001', 'fff0:0001\n', 'fff00001', 'fff0:00011', ' fff0:0001'],
      CARD_ID: ['Bad-Id', 'a.b', 'A'.repeat(33), 'Duo ', 'Duo/..'],
      USB_PORT: ['0000:00:14.0-2;rm', 'a b', '../x', 'P'.repeat(65), '$(id)'],
      USB_SERIAL: ['SN 0001', 'SN;rm', '../x', 'S'.repeat(65), '$(id)', 'SN\n'],
      FORMAT: ['s32_le', 'FLOAT_LE', 'S32_LE ', 'S32_BE'],
      FACTS_SOURCE: ['stream', 'DEVICE', 'ASSUMED '],
    };
    expect(Object.keys(inside).sort()).toEqual(Object.values(CardStringKind).sort());
    let checked = 0;
    for (const kind of Object.values(CardStringKind)) {
      for (const text of inside[kind]) expect(cardListingText(kind, text), `${kind} / ${text}`).toBe(text);
      for (const text of [...NEVER, ...outsideOf[kind]]) {
        expect(cardListingText(kind, text), `${kind} / ${JSON.stringify(text)}`).toBe(replacement[kind]);
        checked += 1;
      }
      for (const value of [undefined, null, 7, 0xfff0, {}, ['DEMS'], { toString: () => 'Duo' }]) expect(cardListingText(kind, value), kind).toBe(replacement[kind]);
      // A fixed word is inside its own rule: passing twice is passing once, and the stored row and the answer stay valid.
      if (replacement[kind] !== null) expect(cardListingText(kind, replacement[kind])).toBe(replacement[kind]);
    }
    // Only a name loses the spaces at its ends; no other kind is changed in any way.
    expect([cardListingText('NAME', '  DEMS Test  '), cardListingText('CARD_ID', ' Duo'), cardListingText('USB_ID', 'fff0:0001 ')]).toEqual(['DEMS Test', null, CARD_USB_ID_REPLACEMENT]);
    // A kind that is none answers nothing, whatever the text.
    for (const kind of ['', 'name', 'RAW', 'toString', '__proto__', undefined, null]) expect(cardListingText(kind as never, 'DEMS Test')).toBeNull();
    console.info(`[row155] the one function | kinds=${Object.values(CardStringKind).length} hostile texts replaced=${checked}`);
  });

  it('the three rule functions of row 64 ARE the one function, and the character rules stand in its table and nowhere else in the file', () => {
    for (const text of [...NEVER, 'DEMS Test', 'fff0:0001', 'Duo', 'Bad-Id', '  DEMS  ', 'a<b']) {
      expect(cardText(text)).toBe(cardListingText('NAME', text) ?? CARD_TEXT_REPLACEMENT);
      expect(cardUsbId(text)).toBe(cardListingText('USB_ID', text) ?? CARD_USB_ID_REPLACEMENT);
      expect(unit.isKernelCardId(text)).toBe(cardListingText('CARD_ID', text) === text);
    }
    const source = readTree(resolve(WORKSPACE, 'src/capture/adapters/audio')).find((file) => file.path === 'card-listing.ts')?.text ?? '';
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const table = /const CARD_STRING_RULES\b[\s\S]*?\n\}\);\n/.exec(code)?.[0] ?? '';
    const outside = code.replace(table, '');
    // Each pattern of a text rule is applied once, inside the table.
    const RULE_USE = /\b(?:CAPTURE_AUDIO_CARD_TEXT_PATTERN|CAPTURE_AUDIO_USB_ID_PATTERN|CAPTURE_AUDIO_CARD_ID_PATTERN|MARKUP|USB_PORT|USB_SERIAL)\.test\(/g;
    expect((table.match(RULE_USE) ?? []).sort()).toEqual(['CAPTURE_AUDIO_CARD_ID_PATTERN.test(', 'CAPTURE_AUDIO_CARD_TEXT_PATTERN.test(', 'CAPTURE_AUDIO_USB_ID_PATTERN.test(', 'MARKUP.test(', 'USB_PORT.test(', 'USB_SERIAL.test('].sort());
    expect(outside.match(RULE_USE)).toBeNull();
    // The table is read by the one function only.
    expect(outside.match(/\bCARD_STRING_RULES\b/g)).toHaveLength(2);
    expect(/export function cardListingText\([^)]*\)[^{]*\{[\s\S]*?CARD_STRING_RULES\[kind\][\s\S]*?\n\}\n/.test(outside)).toBe(true);
    // Each of the four results that carry text is built at ONE place, by the exit that applies the table.
    expect((code.match(/passCardStrings<(\w+)>\(CARD_LISTING_STRING_FIELDS\.(\w+),/g) ?? []).sort()).toEqual(
      ['CaptureCard', 'CardUsbIdentity', 'ListedCaptureDevice', 'PresentCard'].map((name) => `passCardStrings<${name}>(CARD_LISTING_STRING_FIELDS.${name},`),
    );
    expect(Object.keys(CARD_LISTING_STRING_FIELDS).sort()).toEqual(['CaptureCard', 'CardUsbIdentity', 'ListedCaptureDevice', 'PresentCard']);
  });

  it('BY TYPE: the table names the kind of every string member of the four results; a string member added without a kind does not compile (controls)', () => {
    // Held by the typecheck of the workspace: each line below is a compile-time statement.
    const listed: CardStringFieldsOf<ListedCaptureDevice> = CARD_LISTING_STRING_FIELDS.ListedCaptureDevice;
    const present: CardStringFieldsOf<PresentCard> = CARD_LISTING_STRING_FIELDS.PresentCard;
    const identity: CardStringFieldsOf<CardUsbIdentity> = CARD_LISTING_STRING_FIELDS.CardUsbIdentity;
    const card: CardStringFieldsOf<CaptureCard> = CARD_LISTING_STRING_FIELDS.CaptureCard;
    // CONTROLS. A card type with one more string member, in each form a string member can take:
    interface WithText extends CaptureCard { readonly vendorText: string }
    interface WithOptionalText extends CaptureCard { readonly note?: string | null }
    interface WithTextList extends CaptureCard { readonly aliases: readonly string[] }
    interface WithWord extends CaptureCard { readonly speed: 'HIGH' | 'FULL' }
    // @ts-expect-error a new string member without a kind: the table is no longer the table of this type
    const text: CardStringFieldsOf<WithText> = CARD_LISTING_STRING_FIELDS.CaptureCard;
    // @ts-expect-error an optional or nullable string is a string member too
    const optional: CardStringFieldsOf<WithOptionalText> = CARD_LISTING_STRING_FIELDS.CaptureCard;
    // @ts-expect-error so is a list of strings
    const list: CardStringFieldsOf<WithTextList> = CARD_LISTING_STRING_FIELDS.CaptureCard;
    // @ts-expect-error and a closed word: it is a string of the answer and gets a kind
    const word: CardStringFieldsOf<WithWord> = CARD_LISTING_STRING_FIELDS.CaptureCard;
    // A member that is no string needs no kind: the same table still fits.
    interface WithNumber extends CaptureCard { readonly sockets: number; readonly balanced: boolean; readonly gains: readonly number[] }
    const numbers: CardStringFieldsOf<WithNumber> = CARD_LISTING_STRING_FIELDS.CaptureCard;
    // @ts-expect-error an entry for a member that holds no string does not compile either
    const surplus: CardStringFieldsOf<CaptureCard> = { ...CARD_LISTING_STRING_FIELDS.CaptureCard, channelCount: CardStringKind.NAME } as const;
    expect([listed, present, identity, card, text, optional, list, word, numbers].every((table) => typeof table === 'object')).toBe(true);
    expect(Object.keys(surplus)).toContain('channelCount');
    expect(CARD_LISTING_STRING_FIELDS.CaptureCard).toEqual({ cardId: 'CARD_ID', usbId: 'USB_ID', usbPort: 'USB_PORT', usbSerial: 'USB_SERIAL', product: 'NAME', factsSource: 'FACTS_SOURCE', formats: 'FORMAT', nativeFormat: 'FORMAT' });
    for (const table of Object.values(CARD_LISTING_STRING_FIELDS)) expect(Object.isFrozen(table)).toBe(true);
  });

  /** Every string of a value, with the member it stands in (an item of a list stands in the list's member). */
  function stringsOf(value: unknown, member = '(top)'): [string, string][] {
    if (typeof value === 'string') return [[member, value]];
    if (Array.isArray(value)) return value.flatMap((item) => stringsOf(item, member));
    if (typeof value === 'object' && value !== null) return Object.entries(value).flatMap(([key, inner]) => stringsOf(inner, key));
    return [];
  }
  /** What is wrong with the strings of one result: a member without a kind, or a text the one function would not answer unchanged. */
  function bypasses(table: Readonly<Record<string, CardStringKind>>, result: unknown): string[] {
    return stringsOf(result).flatMap(([member, text]) => {
      if (!Object.hasOwn(table, member)) return [`${member}: no kind`];
      const kind = table[member] as CardStringKind;
      return cardListingText(kind, text) === text && PRINTABLE.test(text) && !/[<>]/.test(text) ? [] : [`${member}: not passed as ${kind}`];
    });
  }

  it('EXHAUSTIVE WALK: over hostile listings, every string of every result has a kind and is what the one function answers; a string member without the rule is found (controls)', async () => {
    let strings = 0;
    const check = (table: Readonly<Record<string, CardStringKind>>, result: unknown, name: string): void => {
      expect(bypasses(table, result), name).toEqual([]);
      strings += stringsOf(result).length;
    };
    for (const hostile of NEVER.filter((text) => !text.includes('\n'))) {
      // The hostile text in every place a device or a host can write one: the name of the list, the product, the port, the USB id, a format word.
      const texts: HostTexts = {
        list: HEADING + listed(1, 'TestCard', hostile),
        table: tableRow(1, 'TestCard', 'USB-Audio', hostile),
        usbId: { 1: `${hostile}\n` },
        streams: { '1:0': `${hostile} at usb-${hostile}, high speed : USB Audio\n\nCapture:\n  Status: Stop\n  Interface 1\n    Altset 1\n    Format: ${hostile || 'x'}\n    Channels: 2\n    Rates: 48000\n    Bits: 24\n    Format: S24_3LE\n\n` },
        // Row 199: the serial is device text too.
        serials: { 1: `${hostile}\n` },
      };
      const result = await listing(texts);
      expect(result.cards.map((card) => card.usbSerial), JSON.stringify(hostile)).toEqual(result.cards.map(() => null));
      for (const card of result.cards) check(CARD_LISTING_STRING_FIELDS.CaptureCard, card, `card / ${JSON.stringify(hostile)}`);
      // A hostile name does not remove the card: it is listed with the fixed word, its integers and the one format of this file's list.
      if (hostile.length <= 400) expect(result.cards.map((card) => [card.cardId, card.product, card.usbId, card.usbPort, card.formats]), JSON.stringify(hostile)).toEqual([['TestCard', CARD_TEXT_REPLACEMENT, CARD_USB_ID_REPLACEMENT, null, ['S24_3LE']]]);
      for (const entry of parseCaptureDeviceList(texts.list).entries) check(CARD_LISTING_STRING_FIELDS.ListedCaptureDevice, entry, 'listed');
      for (const present of parsePresentCards(texts.table).cards) check(CARD_LISTING_STRING_FIELDS.PresentCard, present, 'present');
      check(CARD_LISTING_STRING_FIELDS.CardUsbIdentity, parseUsbIdentity(texts.usbId?.[1], texts.streams?.['1:0'], texts.serials?.[1]), 'identity');
      // The exported composer too, handed raw text by a caller that skipped the parsers.
      const composed = buildCaptureCard(
        { cardIndex: 1, deviceIndex: 0, cardId: 'TestCard', cardName: hostile },
        { usb: true, usbId: hostile, usbPort: hostile, usbSerial: hostile, product: hostile },
        { channelCount: 2, formats: ['S32_LE', hostile as never], sampleBits: [24], ratesHz: [48_000] },
        null,
      );
      check(CARD_LISTING_STRING_FIELDS.CaptureCard, composed, 'composed');
      expect([composed?.product, composed?.usbId, composed?.usbPort, composed?.usbSerial, composed?.formats]).toEqual([CARD_TEXT_REPLACEMENT, CARD_USB_ID_REPLACEMENT, null, null, ['S32_LE']]);
      // ... and a card id that is none is not listed, by the composer either.
      expect(buildCaptureCard({ cardIndex: 1, deviceIndex: 0, cardId: hostile, cardName: 'X' }, { usb: false, usbId: null, usbPort: null, usbSerial: null, product: null }, null, null)).toBeNull();
    }
    expect(strings).toBeGreaterThan(200);
    // CONTROLS: the walk finds what it must find.
    const good = (await listing(oneUsbCard('DEMS Test'))).cards[0] as CaptureCard;
    expect(bypasses(CARD_LISTING_STRING_FIELDS.CaptureCard, good)).toEqual([]);
    expect(stringsOf(good).map(([member]) => member).sort()).toEqual(['cardId', 'factsSource', 'formats', 'nativeFormat', 'product', 'usbId', 'usbPort']);
    expect(bypasses(CARD_LISTING_STRING_FIELDS.CaptureCard, { ...good, vendorText: 'DEMS' })).toEqual(['vendorText: no kind']);
    expect(bypasses(CARD_LISTING_STRING_FIELDS.CaptureCard, { ...good, extra: { nested: ['DEMS'] } })).toEqual(['nested: no kind']);
    expect(bypasses(CARD_LISTING_STRING_FIELDS.CaptureCard, { ...good, product: 'DEMS ‮tset' })).toEqual(['product: not passed as NAME']);
    expect(bypasses(CARD_LISTING_STRING_FIELDS.CaptureCard, { ...good, product: 'DEMS <b>' })).toEqual(['product: not passed as NAME']);
    expect(bypasses(CARD_LISTING_STRING_FIELDS.CaptureCard, { ...good, formats: ['S32_LE', 'FLOAT_LE'] })).toEqual(['formats: not passed as FORMAT']);
    expect(bypasses(CARD_LISTING_STRING_FIELDS.CaptureCard, { ...good, usbId: 'FFF0:0001' })).toEqual(['usbId: not passed as USB_ID']);
    // What row 64 answered raw: the card name of the list. It has a kind now and is the fixed word.
    expect(parseCaptureDeviceList(HEADING + listed(1, 'TestCard', 'DEMS ‮tset')).entries).toEqual([{ cardIndex: 1, deviceIndex: 0, cardId: 'TestCard', cardName: CARD_TEXT_REPLACEMENT }]);
    console.info(`[row155] exhaustive walk | hostile listings=${NEVER.length - 1} strings checked=${strings} bypasses=0 | controls found: 6 of 6`);
  });

  it('the answer and the STORED ROW: the fixed word and the fixed id are what the contract of the answer and the CHECKs of the stored row accept; the raw text is not', async () => {
    // The stored row of a registered input (`capture_audio_inputs`, schema set A): its two text columns and their CHECKs, read from the migration.
    const migration = readTree(resolve(WORKSPACE, 'src/db/migrations')).find((file) => file.path === '0015_capture_streams_audio_inputs.sql')?.text ?? '';
    const checkOf = (column: string): RegExp => new RegExp(new RegExp(`"${column}" ~ '([^']+)'`).exec(migration)?.[1] ?? '$never^');
    const [storedUsbId, storedCardId] = [checkOf('usb_id'), checkOf('card_id')];
    expect([storedUsbId.source, storedCardId.source]).toEqual(['^[0-9a-f]{4}:[0-9a-f]{4}$', '^[A-Za-z0-9_]{1,32}$']);
    for (const [label, hostile] of [['control', 'DEMS\u0007Test'], ['bidirectional', 'DEMS ‮tset'], ['zero-width', 'DEMS​Test'], ['oversized', 'D'.repeat(200)]] as const) {
      const card = (await listing(oneUsbCard(hostile, hostile, `${hostile}\n`))).cards[0] as CaptureCard;
      // In the answer: the fixed word and the fixed id.
      expect([card.product, card.usbId], label).toEqual([CARD_TEXT_REPLACEMENT, CARD_USB_ID_REPLACEMENT]);
      expect(CaptureAudioCardSchema.safeParse(asAnswer(card)).success, label).toBe(true);
      // In the stored row: the values a registration writes from this card pass the row's CHECKs ...
      expect([storedUsbId.test(card.usbId ?? ''), storedCardId.test(card.cardId)], label).toEqual([true, true]);
      // ... and the raw text would not have (control), nor would the answer's contract take it.
      expect([storedUsbId.test(hostile), CaptureAudioCardSchema.safeParse({ ...asAnswer(card), product: hostile }).success, CaptureAudioCardSchema.safeParse({ ...asAnswer(card), usbId: hostile }).success], label).toEqual([false, false, false]);
    }
    // A malformed USB id alone (the name is fine) is replaced, and the card stays a USB card.
    const malformed = (await listing(oneUsbCard('DEMS Test', 'DEMS Test', 'FFF0-0001\n'))).cards[0] as CaptureCard;
    expect([malformed.usb, malformed.usbId, malformed.product]).toEqual([true, CARD_USB_ID_REPLACEMENT, 'DEMS Test']);
    console.info('[row155] answer and stored row | product=UNKNOWN usbId=0000:0000 for control, bidirectional, zero-width and oversized text; a malformed USB id is replaced');
  });
});

describe('malformed and cut text', () => {
  it('numbers out of range, repeated and contradicting entries are refused and counted', () => {
    const list =
      HEADING +
      listed(32, 'TooHigh', 'X') +
      listed(1, 'Duo', 'X', 32) +
      'card 999999: Huge [X], device 0: USB Audio [USB Audio]\n' +
      'card 1: Duo [no device mark]\n' +
      'card x: Duo [X], device 0: USB Audio [USB Audio]\n' +
      listed(1, 'Duo', 'X') +
      listed(1, 'Duo', 'X') +
      listed(1, 'Other', 'X', 1) +
      listed(2, 'Duo', 'X', 1) +
      listed(1, 'Duo', 'X', 1);
    expect(parseCaptureDeviceList(list)).toEqual({
      entries: [
        { cardIndex: 1, deviceIndex: 0, cardId: 'Duo', cardName: 'X' },
        { cardIndex: 1, deviceIndex: 1, cardId: 'Duo', cardName: 'X' },
      ],
      skipped: 8,
    });
  });

  it('text that is no list gives no card', async () => {
    const noise = ['\u0000\u0001\u0002��', 'card', 'card \n', '{"cards":[]}\n', '<html>card 1: Duo [X], device 0: USB Audio [USB Audio]</html>\n', 'usage: arecord [OPTION]... [FILE]...\n'];
    for (const list of noise) expect((await listing({ list })).cards, JSON.stringify(list)).toEqual([]);
    for (const value of [null, undefined]) expect(parseCaptureDeviceList(value)).toEqual({ entries: [], skipped: 0 });
    expect(parseStreamCapture('Capture:\n')).toBeNull();
    expect(parseStreamCapture('Capture:\n    Channels: 0\n')).toBeNull();
    expect(parseStreamCapture('Capture:\n    Channels: two\n    Channels: -4\n    Channels: 2 x\n')).toBeNull();
  });

  it('a last line with no line end is a cut line: it states nothing', async () => {
    // The list cut inside its second entry: one card, and the cut entry is not read as device 1 of 12.
    const cut = HEADING + listed(1, 'Duo', 'DEMS Test Duo') + 'card 2: SixTest [DEMS Test Six], device 1';
    expect(parseCaptureDeviceList(cut).entries.map((entry) => entry.cardId)).toEqual(['Duo']);
    expect(parseCaptureDeviceList(`${HEADING}card 2: SixTest [DEMS Test Six], device 1: USB Audio [USB Audio]`).entries).toEqual([]);
    // A stream file cut inside "Channels: 16": never read as 1.
    const whole = usbStream('DEMS Test Sixteen', '1-1', side('Capture', [{ format: 'S32_LE', channels: 16, rates: '48000', bits: 24 }]));
    expect(parseStreamCapture(whole)?.channelCount).toBe(16);
    const inside = whole.slice(0, whole.indexOf('Channels: 16') + 'Channels: 1'.length);
    expect(inside.endsWith('Channels: 1')).toBe(true);
    expect(parseStreamCapture(inside)).toBeNull();
    // In a listing the cut file states no count: the card is marked ASSUMED, which a caller that stores a count refuses.
    const card = (await listing({ list: HEADING + listed(1, 'Sixteen', 'DEMS Test Sixteen'), usbId: { 1: 'fff0:0010\n' }, streams: { '1:0': inside } })).cards[0] as CaptureCard;
    expect(card).toMatchObject({ channelCount: 2, factsSource: 'ASSUMED', formats: [], nativeFormat: 'S32_LE' });
  });

  it('a text beyond the bound is not read at all; a line beyond the bound is passed over', async () => {
    const long = HEADING + listed(1, 'Duo', 'DEMS Test Duo') + '#'.repeat(70_000) + '\n';
    expect(parseCaptureDeviceList(long)).toEqual({ entries: [], skipped: 0 });
    expect(parseStreamCapture(`${DUO_STREAM}${' '.repeat(70_000)}\n`)).toBeNull();
    const longLine = `card 1: Duo [${'X'.repeat(600)}], device 0: USB Audio [USB Audio]\n`;
    expect(parseCaptureDeviceList(HEADING + longLine + listed(2, 'SixTest', 'DEMS Test Six')).entries.map((entry) => entry.cardId)).toEqual(['SixTest']);
  });

  it('an entry the kernel\'s table does not know, a USB device with no stream file and a channel count beyond 64 are not offered', async () => {
    const list = HEADING + listed(1, 'Duo', 'DEMS Test Duo') + listed(2, 'Ghost', 'DEMS Test Ghost') + listed(3, 'Duo', 'X');
    const known = await listing({ list, table: tableRow(1, 'Duo', 'USB-Audio', 'DEMS Test Duo') + tableRow(2, 'Other', 'USB-Audio', 'X'), usbId: { 1: 'fff0:0002\n' }, streams: { '1:0': DUO_STREAM } });
    expect([known.cards.map((card) => card.cardId), known.skipped]).toEqual([['Duo'], 2]);
    const noStream = await listing({ list: HEADING + listed(1, 'Duo', 'DEMS Test Duo') + listed(1, 'Duo', 'DEMS Test Duo', 1), usbId: { 1: 'fff0:0002\n' }, streams: { '1:0': DUO_STREAM } });
    expect([noStream.cards.map((card) => card.deviceIndex), noStream.skipped]).toEqual([[0], 1]);
    for (const [channels, offered] of [[64, 1], [65, 0], [999, 0]] as const) {
      const wide = await listing({ list: HEADING + listed(1, 'Wide', 'DEMS Test Wide'), usbId: { 1: 'fff0:0040\n' }, streams: { '1:0': usbStream('DEMS Test Wide', '1-1', side('Capture', [{ format: 'S32_LE', channels, rates: '48000', bits: 24 }])) } });
      expect([wide.cards.length, wide.skipped], String(channels)).toEqual([offered, 1 - offered]);
    }
  });

  it('more than 32 entries: 32 are answered and the answer says it is cut', async () => {
    const entries = Array.from({ length: 17 }, (_, card) => listed(card, `Card${card}`, 'DEMS Test', 0) + listed(card, `Card${card}`, 'DEMS Test', 1)).join('');
    const result = await listing({ list: HEADING + entries });
    expect([result.cards.length, result.truncated, result.skipped]).toEqual([32, true, 0]);
    const exact = await listing({ list: HEADING + Array.from({ length: 32 }, (_, card) => listed(card, `Card${card}`, 'DEMS Test')).join('') });
    expect([exact.cards.length, exact.truncated]).toEqual([32, false]);
  });

  it('a failure of the source is passed on unchanged', async () => {
    const failure = new Error('the listing program did not start');
    const { source } = host({ list: HEADING });
    await expect(createCardEnumerator({ ...source, captureDevices: async () => Promise.reject(failure) }).list()).rejects.toBe(failure);
  });
});

describe('an input beyond the card is refused by name (S3-2)', () => {
  const duo = { channelCount: 2 };
  const six = { channelCount: 6 };

  it('raises AUDIO_INPUT_BEYOND_CARD, with the registry id at most and no number in its text', () => {
    for (const [card, inputs] of [[duo, [3]], [duo, [1, 3]], [six, [7]], [six, [64]], [{ channelCount: 1 }, [2]]] as const) {
      let raised: unknown = null;
      try {
        selectCardInputs(card, inputs, 'MIC-03');
      } catch (error) {
        raised = error;
      }
      expect(raised).toBeInstanceOf(AudioInputBeyondCardError);
      expect((raised as AudioInputBeyondCardError).code).toBe(AUDIO_INPUT_BEYOND_CARD);
      expect((raised as AudioInputBeyondCardError).deviceId).toBe('MIC-03');
      expect(/\d/.test((raised as AudioInputBeyondCardError).message)).toBe(false);
    }
    expect(() => selectCardInputs(six, [7])).toThrow(AudioInputBeyondCardError);
    expect(() => allocateCardInput(duo, { inputNumber: 3, sampleRateHz: 48_000 }, [])).toThrow(AudioInputBeyondCardError);
    // The last input of the card is not beyond it.
    expect(selectCardInputs(six, [6]).channelIndexes).toEqual([5]);
    expect(selectCardInputs({ channelCount: 64 }, [64]).channelIndexes).toEqual([63]);
  });

  it('an input number that is no input number is a caller\'s error, not a refusal of the card', () => {
    for (const inputs of [[], [0], [-1], [1.5], [Number.NaN], [1, 1], ['1' as unknown as number]]) expect(() => selectCardInputs(six, inputs), JSON.stringify(inputs)).toThrow(RangeError);
  });
});

describe('the one-room rules and the one rate of a card', () => {
  const six = { channelCount: 6 };
  const holders = [
    { deviceId: 'MIC-01', inputNumber: 1, sampleRateHz: 48_000 },
    { deviceId: 'MIC-02', inputNumber: 2, sampleRateHz: 48_000 },
  ];

  it('one input belongs to one microphone; every microphone of a card has the same rate', () => {
    expect(allocateCardInput(six, { inputNumber: 3, sampleRateHz: 48_000 }, holders)).toEqual({ ok: true, selection: { openChannels: 6, channelIndexes: [2], whole: false } });
    expect(allocateCardInput(six, { inputNumber: 2, sampleRateHz: 48_000 }, holders)).toEqual({ ok: false, reason: CardAllocationRefusal.INPUT_TAKEN, heldBy: 'MIC-02' });
    expect(allocateCardInput(six, { inputNumber: 3, sampleRateHz: 44_100 }, holders)).toEqual({ ok: false, reason: CardAllocationRefusal.RATE_DIFFERS, heldBy: 'MIC-01' });
    // The requester itself is passed over: a microphone that is enabled again keeps its input.
    expect(allocateCardInput(six, { inputNumber: 2, sampleRateHz: 48_000, deviceId: 'MIC-02' }, holders).ok).toBe(true);
    // The first microphone of a card sets the rate.
    expect(allocateCardInput(six, { inputNumber: 1, sampleRateHz: 96_000 }, []).ok).toBe(true);
  });

  it('the rate a card is opened with: the wanted one, else 48 000, else its lowest', () => {
    expect(cardSampleRate({ ratesHz: [44_100, 48_000, 96_000], rateRangeHz: null }, 96_000)).toBe(96_000);
    expect(cardSampleRate({ ratesHz: [44_100, 48_000, 96_000], rateRangeHz: null }, 32_000)).toBe(48_000);
    expect(cardSampleRate({ ratesHz: [16_000], rateRangeHz: null }, 48_000)).toBe(16_000);
    expect(cardSampleRate({ ratesHz: [], rateRangeHz: { minHz: 44_100, maxHz: 192_000 } }, 96_000)).toBe(96_000);
    expect(cardSampleRate({ ratesHz: [], rateRangeHz: { minHz: 44_100, maxHz: 192_000 } }, 16_000)).toBe(48_000);
    expect(cardSampleRate({ ratesHz: [], rateRangeHz: { minHz: 16_000, maxHz: 16_000 } }, 48_000)).toBe(16_000);
    expect(cardSampleRate({ ratesHz: [], rateRangeHz: null }, 48_000)).toBe(48_000);
    expect(cardSampleRate({ ratesHz: [], rateRangeHz: null }, 4_000)).toBe(48_000);
  });
});

describe('no card is chosen by the code', () => {
  const AREA = 'src/capture/adapters/audio/';
  const area = readTree(resolve(WORKSPACE, AREA)).filter((file) => file.path.endsWith('.ts') && !file.path.startsWith('__tests__/'));
  /** The words of a generic source: the name input-av gave it, and a first-of-the-list pick. Comments are searched too. */
  const CHOICE = new RegExp([`a${'uto'}`, `\\bcards\\s*\\[\\s*0\\s*\\]`, `\\b${'first'}Usb\\b`, `\\b${'default'}Card\\b`, `\\bany${'Card'}\\b`].join('|'), 'gi');

  it('the search finds the words when they are there (control), and 0 in the area', () => {
    expect(occurrences([{ path: 'x.ts', text: `const source = 'alsa:a${'uto'}-usb';\nreturn listing.cards[0];\nconst d = A${'UTO'}_SOURCE;` }], CHOICE)).toEqual(['x.ts:1', 'x.ts:2', 'x.ts:3']);
    // Every production file of the area is searched, also one a later row adds.
    expect(area.map((file) => file.path)).toEqual(expect.arrayContaining(['card-listing-reader.ts', 'card-listing.ts', 'usb-audio.ts']));
    expect(occurrences(area, CHOICE)).toEqual([]);
  });

  it('the unit exports nothing that returns a card without its name', () => {
    expect(Object.keys(unit).sort()).toEqual(
      [
        'CARD_ASSUMED_CHANNELS',
        'CARD_ASSUMED_RATE_RANGE',
        'CARD_DEFAULT_FORMAT',
        'CARD_DEFAULT_RATE_HZ',
        'CARD_FORMAT_PREFERENCE',
        'CARD_LISTING_LIMITS',
        'CARD_LISTING_STRING_FIELDS',
        'CARD_TEXT_REPLACEMENT',
        'CARD_USB_ID_REPLACEMENT',
        'CardAllocationRefusal',
        'CardFactsSource',
        'CardStringKind',
        'allocateCardInput',
        'buildCaptureCard',
        'cardListingText',
        'cardSampleRate',
        'cardText',
        'cardUsbId',
        'createCardEnumerator',
        'findCaptureCard',
        'isKernelCardId',
        'parseCaptureDeviceList',
        'parseHwParams',
        'parsePresentCards',
        'parseStreamCapture',
        'parseUsbIdentity',
        'selectCardInputs',
      ].sort(),
    );
    expect(Object.keys(createCardEnumerator(host({ list: HEADING }).source))).toEqual(['list']);
    expect(unit.CARD_FORMAT_PREFERENCE).toEqual(['S32_LE', 'S24_3LE', 'S24_LE', 'S16_LE']);
  });
});
