// The reader of the card listing (task 4 blueprint row 64, WP-07a; decision text SR-1, entry 3).
//
// THE DOUBLE. There is no `/proc/asound` on this host. The reader is given a directory of fixed
// files that this test writes below the system's temporary directory, in the layout of the
// kernel's sound directory, with synthetic names. What this proves: which files are read, that a
// path is made of integers, what an absent, an over-long and an unreadable file give, and that
// the reader and the parser fit. That the kernel of a real host lays its files out this way and
// lets the Core's account read them is proven on hardware (record `implementation/064_card_listing.md`).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CARD_LISTING_LIMITS, createCardEnumerator } from '../card-listing';
import { CARD_DEVICES_ROOT, CARD_LISTING_READ_FAILED, CARD_LISTING_ROOT, CardListingReadError, createCardListingReader } from '../card-listing-reader';

const root = mkdtempSync(join(tmpdir(), 'dems-card-listing-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
// Row 199: the kernel's list of sound cards AS DEVICES, as a directory of fixed files. On a real
// host `card<N>/device` is a link to the USB interface and the directory above THAT is the USB
// device with its `serial`; here `device` is a plain directory, so the directory above it is
// `card<N>` itself and the fixture's serial lies there. The path the reader builds is the same.
const devices = mkdtempSync(join(tmpdir(), 'dems-card-devices-'));
afterAll(() => rmSync(devices, { recursive: true, force: true }));
mkdirSync(join(devices, 'card1', 'device'), { recursive: true });
writeFileSync(join(devices, 'card1', 'serial'), 'DEMS-SN-000123\n');
// Card 3: a USB device that states no serial (the attribute is absent). Card 4: a serial that cannot be read.
mkdirSync(join(devices, 'card3', 'device'), { recursive: true });
mkdirSync(join(devices, 'card4', 'device'), { recursive: true });
mkdirSync(join(devices, 'card4', 'serial'));

const LIST =
  '**** List of CAPTURE Hardware Devices ****\n' +
  'card 0: Onboard [DEMS Onboard Analog], device 0: Analog [Analog]\n  Subdevices: 1/1\n  Subdevice #0: subdevice #0\n' +
  'card 1: Duo [DEMS Test Duo], device 0: USB Audio [USB Audio]\n  Subdevices: 1/1\n  Subdevice #0: subdevice #0\n';
const STREAM =
  'DEMS Test Duo at usb-0000:00:14.0-2, high speed : USB Audio\n\nCapture:\n  Status: Stop\n  Interface 1\n    Altset 1\n    Format: S24_3LE\n    Channels: 2\n    Endpoint: 0x81 (1 IN) (ASYNC)\n    Rates: 44100, 48000\n    Bits: 24\n';

mkdirSync(join(root, 'card0'));
mkdirSync(join(root, 'card1'));
mkdirSync(join(root, 'card2', 'usbid'), { recursive: true });
writeFileSync(join(root, 'cards'), ' 0 [Onboard        ]: HDA-Intel - DEMS Onboard Analog\n                      DEMS Onboard Analog at 0xf7f10000 irq 33\n 1 [Duo            ]: USB-Audio - DEMS Test Duo\n                      DEMS Test Duo at usb-0000:00:14.0-2, high speed\n');
writeFileSync(join(root, 'card1', 'usbid'), 'fff0:0002\n');
writeFileSync(join(root, 'card1', 'stream0'), STREAM);
writeFileSync(join(root, 'card1', 'stream1'), 'x'.repeat(CARD_LISTING_LIMITS.textCharacters + 1));
writeFileSync(join(root, 'card1', 'stream2'), `${'y'.repeat(CARD_LISTING_LIMITS.textCharacters - 1)}\n`);

const programs = { captureDevices: async () => LIST };

describe('the reader of the card listing', () => {
  it('reads the three kinds of file unchanged; an absent file is null', async () => {
    const reader = createCardListingReader(programs, root);
    expect(await reader.captureDevices()).toBe(LIST);
    expect(await reader.presentCards()).toMatch(/^ 0 \[Onboard/);
    expect(await reader.usbId(1)).toBe('fff0:0002\n');
    expect(await reader.stream(1, 0)).toBe(STREAM);
    expect(await reader.usbId(0)).toBeNull();
    expect(await reader.stream(0, 0)).toBeNull();
    expect(await reader.usbId(31)).toBeNull();
    expect(await createCardListingReader(programs, join(root, 'nothing-here')).presentCards()).toBeNull();
    expect(CARD_LISTING_ROOT).toBe('/proc/asound');
  });

  it('a file beyond the bound is null, one at the bound is read whole', async () => {
    const reader = createCardListingReader(programs, root);
    expect(await reader.stream(1, 1)).toBeNull();
    expect((await reader.stream(1, 2))?.length).toBe(CARD_LISTING_LIMITS.textCharacters);
  });

  it('a path is made of two integers in their range: anything else is refused before a file is touched', async () => {
    const reader = createCardListingReader({ ...programs, hwParams: async () => 'CHANNELS: 2\n' }, root);
    for (const value of [-1, 32, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1' as unknown as number, '../card1' as unknown as number]) {
      await expect(reader.usbId(value), String(value)).rejects.toBeInstanceOf(RangeError);
      await expect(reader.stream(value, 0), String(value)).rejects.toBeInstanceOf(RangeError);
      await expect(reader.stream(1, value), String(value)).rejects.toBeInstanceOf(RangeError);
      await expect(reader.hwParams?.(value, 0), String(value)).rejects.toBeInstanceOf(RangeError);
      await expect(reader.hwParams?.(1, value), String(value)).rejects.toBeInstanceOf(RangeError);
    }
    expect(await reader.hwParams?.(1, 0)).toBe('CHANNELS: 2\n');
    // Without the program the member does not exist: the parser then marks such a card ASSUMED.
    expect('hwParams' in createCardListingReader(programs, root)).toBe(false);
  });

  it('a file that exists and cannot be read raises the named error, with the short code and no path', async () => {
    const reader = createCardListingReader(programs, root);
    let raised: unknown = null;
    try {
      // `card2/usbid` is a directory.
      await reader.usbId(2);
    } catch (error) {
      raised = error;
    }
    expect(raised).toBeInstanceOf(CardListingReadError);
    const error = raised as CardListingReadError;
    expect([error.code, error.reason, error.message]).toEqual([CARD_LISTING_READ_FAILED, 'EISDIR', 'a file of the card listing could not be read']);
    expect(JSON.stringify({ ...error, message: error.message }).includes(root)).toBe(false);
  });

  it('row 199: the serial of the USB device behind a card - ONE more file, read only, by the card index; absent is null, unreadable is the named error', async () => {
    const reader = createCardListingReader(programs, root, devices);
    expect(await reader.usbSerial?.(1)).toBe('DEMS-SN-000123\n');
    // A device that states no serial, and a card the device list does not have at all.
    expect(await reader.usbSerial?.(3)).toBeNull();
    expect(await reader.usbSerial?.(9)).toBeNull();
    // A host without the device list (no such directory): every card is listed with no serial.
    expect(await createCardListingReader(programs, root, join(devices, 'nothing-here')).usbSerial?.(1)).toBeNull();
    for (const value of [-1, 32, 1.5, Number.NaN, '1' as unknown as number, '../card1' as unknown as number]) await expect(reader.usbSerial?.(value), String(value)).rejects.toBeInstanceOf(RangeError);
    // A serial that exists and cannot be read is NOT "no serial": the listing fails by the named error, with no path.
    const raised = await reader.usbSerial?.(4).then(() => null, (error: unknown) => error);
    expect(raised).toBeInstanceOf(CardListingReadError);
    expect([(raised as CardListingReadError).reason, JSON.stringify({ ...(raised as CardListingReadError) }).includes(devices)]).toEqual(['EISDIR', false]);
    expect(CARD_DEVICES_ROOT).toBe('/sys/class/sound');
    // Reader and parser together: the serial reaches the card, and only the card that has one.
    const result = await createCardEnumerator(createCardListingReader({ ...programs, hwParams: async () => 'FORMAT:  S16_LE\nCHANNELS: 2\nRATE: [44100 48000]\n' }, root, devices)).list();
    expect(result.cards.map((card) => [card.cardId, card.usbSerial, card.usbPort])).toEqual([
      ['Onboard', null, null],
      ['Duo', 'DEMS-SN-000123', '0000:00:14.0-2'],
    ]);
  });

  it('reader and parser together: the cards of the directory', async () => {
    const result = await createCardEnumerator(createCardListingReader({ ...programs, hwParams: async (cardIndex, deviceIndex) => (cardIndex === 0 && deviceIndex === 0 ? 'FORMAT:  S16_LE\nCHANNELS: 2\nRATE: [44100 48000]\n' : null) }, root, join(devices, 'nothing-here'))).list();
    expect(result.skipped).toBe(0);
    expect(result.cards.map((card) => [card.cardIndex, card.deviceIndex, card.cardId, card.usbId, card.usbPort, card.product, card.channelCount, card.factsSource, card.nativeFormat])).toEqual([
      [0, 0, 'Onboard', null, null, 'DEMS Onboard Analog', 2, 'HW_PARAMS', 'S16_LE'],
      [1, 0, 'Duo', 'fff0:0002', '0000:00:14.0-2', 'DEMS Test Duo', 2, 'STREAM', 'S24_3LE'],
    ]);
  });
});
