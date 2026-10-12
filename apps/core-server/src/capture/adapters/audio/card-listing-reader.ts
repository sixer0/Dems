/**
 * The reader of the card listing (task 4 row 64, WP-07a): the ONE file of the card listing that
 * touches the file system, admitted to the pinned lists of static rule G-R2 by decision text
 * SR-1, entry 3, FOR READING ONLY. It reads three kinds of file below the sound directory of the
 * kernel (`audio.py:83-89,124,325` of input-av read the same):
 *
 *   <root>/cards                     the card table
 *   <root>/card<N>/usbid             the USB id of a card (absent: the card is not USB)
 *   <root>/card<N>/stream<D>         what a USB capture device can do
 *
 * N and D are INTEGERS, 0 to 31, checked here; no path holds a text a device announced. Each
 * file is opened for reading, read up to a bound and closed. Nothing is written, created or
 * removed, and no process is started: the two texts that only a program can give (the list of
 * capture hardware, the hardware parameter dump) are HANDED IN, by the unit that owns the
 * production door.
 *
 * It does not log (the capture folder logs in one place). An absent file is `null`; any other
 * failure is raised as `CardListingReadError`, which carries the system's short code and no path.
 */
import { open } from 'node:fs/promises';
import { CARD_LISTING_LIMITS, type CardListingSource } from './card-listing';

/** The sound directory of the kernel on a Linux host. */
export const CARD_LISTING_ROOT = '/proc/asound';

export const CARD_LISTING_READ_FAILED = 'CARD_LISTING_READ_FAILED';

/** A file of the listing that exists and could not be read. Fixed text; `reason` is a short code such as `EACCES`. */
export class CardListingReadError extends Error {
  readonly code: typeof CARD_LISTING_READ_FAILED = CARD_LISTING_READ_FAILED;
  readonly reason: string;
  constructor(reason: string) {
    super('a file of the card listing could not be read');
    this.name = 'CardListingReadError';
    this.reason = reason;
  }
}

/** The two texts a program gives. Both take integers only (`CardListingSource`). */
export interface CardListingPrograms {
  captureDevices(): Promise<string>;
  hwParams?(cardIndex: number, deviceIndex: number): Promise<string | null>;
}

const ABSENT = new Set(['ENOENT', 'ENOTDIR']);
const index = (value: number, max: number): number => {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new RangeError('a card or device index is a whole number within its range');
  return value;
};

/** The text of one file, null when it is absent or longer than the bound (a cut text is not a listing). */
async function readText(path: string): Promise<string | null> {
  const bound = CARD_LISTING_LIMITS.textCharacters;
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(path, 'r');
    const bytes = Buffer.alloc(bound + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    return length > bound ? null : bytes.subarray(0, length).toString('utf8');
  } catch (error) {
    const reason = typeof (error as { code?: unknown } | null)?.code === 'string' ? (error as { code: string }).code : '';
    if (ABSENT.has(reason)) return null;
    throw new CardListingReadError(/^[A-Z0-9_]{1,32}$/.test(reason) ? reason : 'UNKNOWN');
  } finally {
    await handle?.close();
  }
}

/**
 * The source of the card listing on a Linux host. `root` is the kernel's sound directory; a test
 * hands in a directory of fixed files, production code hands in nothing.
 */
export function createCardListingReader(programs: CardListingPrograms, root: string = CARD_LISTING_ROOT): CardListingSource {
  const card = (cardIndex: number): string => `${root}/card${index(cardIndex, CARD_LISTING_LIMITS.cardIndexMax)}`;
  const hwParams = programs.hwParams;
  return {
    captureDevices: () => programs.captureDevices(),
    presentCards: () => readText(`${root}/cards`),
    usbId: async (cardIndex) => readText(`${card(cardIndex)}/usbid`),
    stream: async (cardIndex, deviceIndex) => readText(`${card(cardIndex)}/stream${index(deviceIndex, CARD_LISTING_LIMITS.deviceIndexMax)}`),
    ...(hwParams === undefined ? {} : { hwParams: async (cardIndex: number, deviceIndex: number) => hwParams(index(cardIndex, CARD_LISTING_LIMITS.cardIndexMax), index(deviceIndex, CARD_LISTING_LIMITS.deviceIndexMax)) }),
  };
}
