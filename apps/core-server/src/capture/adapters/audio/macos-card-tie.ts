/**
 * THE TIE of the three lists of a macOS host (task 4 row N6; design 3.1, 3.3; review SM-01,
 * SM-03, SM-05, SM-13, SM-22): one listed USB audio INPUT device is one device of the USB tree,
 * one input item of the system list and one audio entry of the capture program's list.
 *
 * WHY A TIE AT ALL. The capture program names a device by a position in its own list and by
 * nothing else; the USB identity stands in another list. The only member the three share is the
 * device NAME. So the tie is made by exact text, and ANY DOUBT REFUSES: a device that cannot be
 * tied one-to-one is not a card of the listing. It is never guessed, and never "absent".
 *
 * A device of the tree with an audio streaming interface becomes a card only when ALL hold in
 * ONE listing (the first that fails names the reason, in this order):
 *
 *   NAME_NOT_TIEABLE    its product string is absent, fails the NAME rule of the card listing as
 *                       it stands (nothing dropped, cut or folded), or holds `://` or `@` (the
 *                       production door blanks the user part of what looks like a locator, so such
 *                       a name is not the text the program printed)
 *   NAME_SHARED         another audio device of the tree states the same string
 *   NO_SYSTEM_INPUT     no readable input item of the system list has that name (also: a confined
 *                       Core, whose system list is empty; a USB output-only device)
 *   NO_CAPTURE_ENTRY    no audio entry of the capture program's list has that name
 *   LISTS_DISAGREE      the readable input items of the system list and the audio entries of the
 *                       capture list are not the same multiset of names: then EVERY device is
 *                       undecided, because a position of a list the Core cannot explain is no index
 *   NAME_SHARED         more than one input item, of ANY transport, or more than one audio entry
 *                       has that name (a built-in, virtual, aggregate or wireless device under the
 *                       name of the USB unit refuses the unit)
 *   TRANSPORT_NOT_USB   the one item of that name does not state the USB transport word
 *
 * and one state that has no device of the tree:
 *
 *   NO_USB_DEVICE       a readable input item states the USB transport word and no audio device
 *                       of the tree has its name. Never a card: it has no identity.
 *
 * An input item that does NOT state the USB transport word (built-in, virtual, aggregate,
 * wireless, an unknown word, no word) is never a card and is not an undecided device either: it
 * is counted in `passedOver`. A listing with only the built-in input lists 0 cards.
 *
 * THE CARD (design 3.1). `usbId`, `usbPort` and `cardId` are written from INTEGERS; the name and
 * the serial are device text and pass `cardListingText`; `cardIndex` is the index of the device's
 * entry in the capture list of THIS listing; `usb` is always true and a USB id always present
 * (SM-01 (b): the branch of the match for a card that is not USB is unreachable from here).
 * `formats` and `sampleBits` are empty: no list states them.
 *
 * NO NAME LEAVES THIS FILE but the product of a tied card, and that through the one function. An
 * undecided device is stated by its USB id, its port, its serial and a reason word - never by the
 * name that was shared (SM-12 (2)).
 */
import {
  CARD_DEFAULT_FORMAT,
  CARD_LISTING_STRING_FIELDS,
  CardFactsSource,
  CardStringKind,
  cardListingText,
  type CaptureCard,
} from './card-listing';
import type { MacosHelperAudioEntry } from './macos-helper-list-reader';
import type { MacosSystemAudioItem } from './macos-system-audio-reader';
import type { MacosUsbAudioDevice } from './macos-usb-tree-reader';

export const MacosUndecidedReason = {
  NAME_NOT_TIEABLE: 'NAME_NOT_TIEABLE',
  NAME_SHARED: 'NAME_SHARED',
  NO_SYSTEM_INPUT: 'NO_SYSTEM_INPUT',
  NO_CAPTURE_ENTRY: 'NO_CAPTURE_ENTRY',
  LISTS_DISAGREE: 'LISTS_DISAGREE',
  TRANSPORT_NOT_USB: 'TRANSPORT_NOT_USB',
  NO_USB_DEVICE: 'NO_USB_DEVICE',
} as const;
export type MacosUndecidedReason = (typeof MacosUndecidedReason)[keyof typeof MacosUndecidedReason];

/** A device that is connected and is NOT a card of the listing. Integers and ruled text only: no name. */
export interface MacosUndecidedDevice {
  readonly reason: MacosUndecidedReason;
  /** `vvvv:pppp`; null only for `NO_USB_DEVICE` (an item of the system list with no device of the tree). */
  readonly usbId: string | null;
  readonly usbPort: string | null;
  readonly usbSerial: string | null;
}

export interface MacosTie {
  /** In the order of the capture program's list. */
  readonly cards: readonly CaptureCard[];
  readonly undecided: readonly MacosUndecidedDevice[];
  /** Input items of the system list that do not state the USB transport word: never offered as `USB_AUDIO`. */
  readonly passedOver: number;
  /**
   * A mark of the ORDERED audio list of the capture program (a 32-bit sum over the entries in
   * order), so that two listings can be compared for "the same ordered list" (design 3.3, the
   * third listing) without a name being kept. Equal lists give equal marks; an equal mark is a
   * check beside the others, not a proof.
   */
  readonly captureOrderMark: number;
  readonly captureEntries: number;
}

/** True for a name the tie may compare: the NAME rule answers it unchanged, and it is no locator. */
export function isTieableName(name: string | null): name is string {
  return typeof name === 'string' && cardListingText(CardStringKind.NAME, name) === name && !name.includes('://') && !name.includes('@');
}

const countOf = (names: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return counts;
};

const sameMultiset = (a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean => a.size === b.size && [...a].every(([name, count]) => b.get(name) === count);

/** FNV-1a over the entries in order, each closed by its index: a change detector, no secret and no identity. */
function orderMark(entries: readonly MacosHelperAudioEntry[]): number {
  let mark = 0x811c9dc5;
  const mix = (code: number): void => {
    mark = Math.imul(mark ^ (code & 0xff), 0x01000193) >>> 0;
    mark = Math.imul(mark ^ (code >>> 8), 0x01000193) >>> 0;
  };
  for (const entry of entries) {
    for (let at = 0; at < entry.name.length; at += 1) mix(entry.name.charCodeAt(at));
    mix(0xff00 | entry.index);
  }
  return mark;
}

/**
 * One card through the exit of the card listing: every string member named in the table of
 * `CaptureCard` passes the one function with its kind. Null when a member that must say something
 * is refused (it cannot be for a card written from integers and a tieable name; held anyway).
 */
function cardOf(device: MacosUsbAudioDevice, item: MacosSystemAudioItem, entry: MacosHelperAudioEntry): CaptureCard | null {
  if (item.inputChannels === null || item.rateHz === null) return null;
  const card: CaptureCard = {
    cardIndex: entry.index,
    deviceIndex: 0,
    cardId: `usb_${device.usbPort}`,
    usb: true,
    usbId: device.usbId,
    usbPort: device.usbPort,
    usbSerial: device.usbSerial,
    product: device.productName ?? '',
    channelCount: item.inputChannels,
    factsSource: CardFactsSource.SYSTEM_PROFILE,
    formats: Object.freeze([]),
    nativeFormat: CARD_DEFAULT_FORMAT,
    sampleBits: Object.freeze([]),
    ratesHz: Object.freeze([item.rateHz]),
    rateRangeHz: null,
  };
  const out: Record<string, unknown> = { ...card };
  for (const [member, kind] of Object.entries(CARD_LISTING_STRING_FIELDS.CaptureCard)) {
    const value = out[member];
    if (value === null) continue;
    if (Array.isArray(value)) {
      out[member] = Object.freeze(value.map((part: unknown) => cardListingText(kind, part)).filter((part): part is string => part !== null));
      continue;
    }
    const passed = cardListingText(kind, value);
    // On this path a card without its port, its USB id or its own name is no card (stricter than the Linux exit, where a port may be none).
    if (passed === null || passed !== value) return null;
  }
  return Object.freeze(out) as unknown as CaptureCard;
}

/** Ties the three lists of ONE listing. See the head of the file for every rule. */
export function tieMacosLists(audioDevices: readonly MacosUsbAudioDevice[], systemItems: readonly MacosSystemAudioItem[], captureEntries: readonly MacosHelperAudioEntry[]): MacosTie {
  const inputs = systemItems.filter((item) => item.input && item.readable);
  const inputCounts = countOf(inputs.map((item) => item.name));
  const entryCounts = countOf(captureEntries.map((entry) => entry.name));
  const treeCounts = countOf(audioDevices.map((device) => device.productName).filter((name): name is string => name !== null));
  const disagree = !sameMultiset(inputCounts, entryCounts);

  const cards: CaptureCard[] = [];
  const undecided: MacosUndecidedDevice[] = [];
  const refuse = (device: MacosUsbAudioDevice, reason: MacosUndecidedReason): void => {
    undecided.push(Object.freeze({ reason, usbId: device.usbId, usbPort: device.usbPort, usbSerial: device.usbSerial }));
  };
  for (const device of audioDevices) {
    const name = device.productName;
    if (!isTieableName(name)) refuse(device, MacosUndecidedReason.NAME_NOT_TIEABLE);
    else if ((treeCounts.get(name) ?? 0) > 1) refuse(device, MacosUndecidedReason.NAME_SHARED);
    else if ((inputCounts.get(name) ?? 0) === 0) refuse(device, MacosUndecidedReason.NO_SYSTEM_INPUT);
    else if ((entryCounts.get(name) ?? 0) === 0) refuse(device, MacosUndecidedReason.NO_CAPTURE_ENTRY);
    else if (disagree) refuse(device, MacosUndecidedReason.LISTS_DISAGREE);
    else if (inputCounts.get(name) !== 1 || entryCounts.get(name) !== 1) refuse(device, MacosUndecidedReason.NAME_SHARED);
    else {
      const item = inputs.find((candidate) => candidate.name === name);
      const entry = captureEntries.find((candidate) => candidate.name === name);
      if (item === undefined || entry === undefined) refuse(device, MacosUndecidedReason.LISTS_DISAGREE);
      else if (!item.usb) refuse(device, MacosUndecidedReason.TRANSPORT_NOT_USB);
      else {
        const card = cardOf(device, item, entry);
        if (card === null) refuse(device, MacosUndecidedReason.NAME_NOT_TIEABLE);
        else cards.push(card);
      }
    }
  }
  // A USB input the system states and the tree does not: no identity, so no card.
  for (const item of inputs) {
    if (item.usb && !treeCounts.has(item.name)) undecided.push(Object.freeze({ reason: MacosUndecidedReason.NO_USB_DEVICE, usbId: null, usbPort: null, usbSerial: null }));
  }
  cards.sort((a, b) => a.cardIndex - b.cardIndex);
  return Object.freeze({
    cards: Object.freeze(cards),
    undecided: Object.freeze(undecided),
    passedOver: systemItems.filter((item) => item.input && !item.usb).length,
    captureOrderMark: orderMark(captureEntries),
    captureEntries: captureEntries.length,
  });
}
