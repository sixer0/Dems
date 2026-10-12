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
import { CARD_LISTING_READ_FAILED, CARD_LISTING_ROOT, CardListingReadError, createCardListingReader } from '../card-listing-reader';

const root = mkdtempSync(join(tmpdir(), 'dems-card-listing-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

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

  it('reader and parser together: the cards of the directory', async () => {
    const result = await createCardEnumerator(createCardListingReader({ ...programs, hwParams: async (cardIndex, deviceIndex) => (cardIndex === 0 && deviceIndex === 0 ? 'FORMAT:  S16_LE\nCHANNELS: 2\nRATE: [44100 48000]\n' : null) }, root)).list();
    expect(result.skipped).toBe(0);
    expect(result.cards.map((card) => [card.cardIndex, card.deviceIndex, card.cardId, card.usbId, card.usbPort, card.product, card.channelCount, card.factsSource, card.nativeFormat])).toEqual([
      [0, 0, 'Onboard', null, null, 'DEMS Onboard Analog', 2, 'HW_PARAMS', 'S16_LE'],
      [1, 0, 'Duo', 'fff0:0002', '0000:00:14.0-2', 'DEMS Test Duo', 2, 'STREAM', 'S24_3LE'],
    ]);
  });
});
