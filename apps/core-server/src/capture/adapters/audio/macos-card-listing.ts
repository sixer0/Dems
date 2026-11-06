/**
 * The card listing of a macOS host (task 4 row N6; design `masterplan/06_design_macos_microphone.md`
 * sections 2 and 3; decision U22: the production microphone path on macOS under the kind
 * `USB_AUDIO`). It answers the SAME shape as the Linux listing (`CardEnumerator`, `CardListing`,
 * `CaptureCard` of `card-listing.ts`), so the registration, the card search and the match of a
 * stored row (`identifyRegisteredCard`) work on it unchanged.
 *
 * THREE TEXTS, HANDED IN (`MacosListingSource`): the USB tree in its property-list form, the
 * system's audio list as JSON, the capture program's own device list. This file and its four
 * readers start no process, open no device and read no file; the three fixed rows and their
 * runner belong to rows N4 and N7. No source method takes an argument: nothing a device announced
 * can become part of a question.
 *
 * UNDECIDED IS NOT EMPTY. A text that fails its reader makes the WHOLE listing undecided:
 * `listTied` answers `ok: false` with the list and a closed word, and `list` (the shape the
 * Linux consumers call) RAISES `MacosCardListingError` - it never answers a listing of no card,
 * which a consumer would read as "the registered card is absent". A device that cannot be tied
 * is counted in `skipped` and stated in `undecided`; `skipped` is then never 0.
 *
 * THE PORT PATH of macOS is the location id of the device, eight lower-case hexadecimal digits
 * written from the integer. It is inside the closed form of the column
 * `capture_audio_inputs.usb_port` (letters, digits and `: . _ -`, 1 to 64) and of the contract
 * member; the card id `usb_<those digits>` is inside the card id's form (letters, digits, the
 * underscore, 1 to 32).
 */
import type { CardEnumerator, CardListing, CaptureCard } from './card-listing';
import { tieMacosLists, type MacosUndecidedDevice } from './macos-card-tie';
import { parseMacosHelperList, type MacosHelperListRefusal } from './macos-helper-list-reader';
import { parseMacosSystemAudio, type MacosSystemAudioRefusal } from './macos-system-audio-reader';
import { parseMacosUsbTree, type MacosUsbTreeRefusal } from './macos-usb-tree-reader';
import type { PlistRefusal } from './macos-plist';

/**
 * Where the three texts come from. Each is handed over UNCHANGED, its line ends included. On a
 * macOS host these are the three fixed rows behind the production door (row N7); in a test, fixed
 * texts. A row that FAILED (did not start, was killed, ended with an error where none is expected)
 * is the source's own failure, raised by it and passed on unchanged: it is never an empty text.
 */
export interface MacosListingSource {
  /** Standard output of the USB tree row, property-list form. Empty when no USB device is connected. */
  usbTree(): Promise<string>;
  /** Standard output of the system audio row, JSON. */
  systemAudio(): Promise<string>;
  /** DIAGNOSTICS of the capture program's device-list row (it ends with an error status by design). */
  captureDevices(): Promise<string>;
}

/** Which of the three lists failed its reader. */
export const MacosListingFailure = {
  USB_TREE_UNREADABLE: 'USB_TREE_UNREADABLE',
  SYSTEM_LIST_UNREADABLE: 'SYSTEM_LIST_UNREADABLE',
  CAPTURE_LIST_UNREADABLE: 'CAPTURE_LIST_UNREADABLE',
} as const;
export type MacosListingFailure = (typeof MacosListingFailure)[keyof typeof MacosListingFailure];

/** The reader's own closed word for what failed. A word of this code, never a text of a list. */
export type MacosListingFailureDetail = MacosUsbTreeRefusal | PlistRefusal | MacosSystemAudioRefusal | MacosHelperListRefusal;

export type MacosTiedListing =
  | {
      readonly ok: true;
      /** The listing in the shape of the Linux one. `truncated` is always false: a list over its bound is refused, never cut. */
      readonly listing: CardListing;
      readonly cards: readonly CaptureCard[];
      /** Connected and NOT a card, each with its reason (the adapter answers `AUDIO_CARD_AMBIGUOUS` for a registered input among them). */
      readonly undecided: readonly MacosUndecidedDevice[];
      /** Devices of the USB tree the reader refused (a key of another type, a location stated twice ...). No identity is stated for them. */
      readonly refusedDevices: number;
      /** Inputs that are no USB device (built-in, virtual, aggregate, wireless): never offered. */
      readonly passedOver: number;
      /** See `MacosTie.captureOrderMark`: for the comparison of two listings of one launch. */
      readonly captureOrderMark: number;
      readonly captureEntries: number;
    }
  | { readonly ok: false; readonly failure: MacosListingFailure; readonly detail: MacosListingFailureDetail };

export const MACOS_CARD_LISTING_UNDECIDED = 'MACOS_CARD_LISTING_UNDECIDED';

/** The whole listing is undecided. Fixed text; `failure` and `detail` are closed words and hold nothing a device announced. */
export class MacosCardListingError extends Error {
  readonly code: typeof MACOS_CARD_LISTING_UNDECIDED = MACOS_CARD_LISTING_UNDECIDED;
  readonly failure: MacosListingFailure;
  readonly detail: MacosListingFailureDetail;
  constructor(failure: MacosListingFailure, detail: MacosListingFailureDetail) {
    super('a list of the card listing could not be read');
    this.name = 'MacosCardListingError';
    this.failure = failure;
    this.detail = detail;
  }
}

/** The three texts of ONE listing to its answer. Pure. */
export function readMacosListing(usbTreeText: unknown, systemAudioText: unknown, captureDevicesText: unknown): MacosTiedListing {
  const failed = (failure: MacosListingFailure, detail: MacosListingFailureDetail): MacosTiedListing => Object.freeze({ ok: false, failure, detail });
  const tree = parseMacosUsbTree(usbTreeText);
  if (!tree.ok) return failed(MacosListingFailure.USB_TREE_UNREADABLE, tree.detail ?? tree.reason);
  const system = parseMacosSystemAudio(systemAudioText);
  if (!system.ok) return failed(MacosListingFailure.SYSTEM_LIST_UNREADABLE, system.reason);
  const capture = parseMacosHelperList(captureDevicesText);
  if (!capture.ok) return failed(MacosListingFailure.CAPTURE_LIST_UNREADABLE, capture.reason);
  const tie = tieMacosLists(tree.audioDevices, system.items, capture.entries);
  const listing: CardListing = Object.freeze({ cards: tie.cards, truncated: false, skipped: tree.refused + tie.undecided.length });
  return Object.freeze({
    ok: true,
    listing,
    cards: tie.cards,
    undecided: tie.undecided,
    refusedDevices: tree.refused,
    passedOver: tie.passedOver,
    captureOrderMark: tie.captureOrderMark,
    captureEntries: tie.captureEntries,
  });
}

export interface MacosCardEnumerator extends CardEnumerator {
  /** Reads the host once and answers everything the tie knows, the undecided devices included. Never raises for an unreadable list. */
  listTied(): Promise<MacosTiedListing>;
}

/** The enumerator of a macOS host. Nothing is kept: two calls are two readings of all three lists. */
export function createMacosCardEnumerator(source: MacosListingSource): MacosCardEnumerator {
  const listTied = async (): Promise<MacosTiedListing> => {
    const usbTree = await source.usbTree();
    const systemAudio = await source.systemAudio();
    const captureDevices = await source.captureDevices();
    return readMacosListing(usbTree, systemAudio, captureDevices);
  };
  return {
    listTied,
    async list() {
      const tied = await listTied();
      if (!tied.ok) throw new MacosCardListingError(tied.failure, tied.detail);
      return tied.listing;
    },
  };
}
