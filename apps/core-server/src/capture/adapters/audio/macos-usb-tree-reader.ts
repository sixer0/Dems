/**
 * The reader of the USB tree on macOS (task 4 row N6; design 2.3 row L1, 3.1; review SM-01,
 * SM-02): from the property-list text of the tree row to the USB AUDIO devices with their
 * identity. Pure: the text is HANDED IN by the unit that owns the production door (row N7).
 *
 * WHAT IS READ of a device dictionary, each BY TYPE and nothing else:
 *
 *   idVendor, idProduct          integers; vendor 1 to 65,535, product 0 to 65,535
 *   locationID                   an integer, 1 to 4,294,967,295: the place of the device on the bus
 *   IORegistryEntryLocation      a string of eight hexadecimal digits that must state the SAME number
 *   USB Serial Number            a string, where the device states one
 *   USB Product Name             a string: text the device chose; it leaves this file RAW, for the
 *                                tie alone, and reaches no result before `cardListingText`
 *   IORegistryEntryChildren      a list of dictionaries; of a child only bInterfaceClass and
 *                                bInterfaceSubClass (integers 0 to 255). A child with neither is
 *                                passed over (a driver node; measured: one per device)
 *
 * A device is an AUDIO device when a direct child states class 1, sub-class 2 (an audio streaming
 * interface). Whether it is an INPUT the tree does not say: that is the system list's word.
 *
 * THE IDENTITY IS WRITTEN FROM INTEGERS (SM-01 (a)): the USB id from the two numbers, the port
 * from the location number. No text of the device is part of either.
 *
 * REFUSED, counted and never repaired: an audio device (or a device whose children cannot be
 * read) with a read key of another type, a vendor, product or location missing or out of range, a
 * location that differs from `IORegistryEntryLocation`; and EVERY audio device whose location
 * another device of the tree states too (SM-02 (4)).
 *
 * THE WHOLE TREE is undecided (a closed word, no device answered) when the text is no property
 * list of the strict form, its top is no list, an entry is no dictionary, or it holds more than
 * 32 devices. AN EMPTY TEXT is a tree of no device: the program prints nothing when no USB device
 * is connected. That the program FAILED is the runner's fact (its exit status), not a text.
 */
import { CAPTURE_AUDIO_CARD_MAX_ENTRIES } from '@dems/shared/api';
import { CardStringKind, cardListingText } from './card-listing';
import { parseMacosPlist, type PlistRefusal, type PlistValue } from './macos-plist';

export const MACOS_USB_TREE_MAX_DEVICES = CAPTURE_AUDIO_CARD_MAX_ENTRIES;

export const MacosUsbTreeRefusal = {
  /** The text is no property list of the strict form; `detail` says which rule. */
  NOT_A_PROPERTY_LIST: 'NOT_A_PROPERTY_LIST',
  /** The top value is no list, or an entry of it is no dictionary. */
  NOT_A_DEVICE_LIST: 'NOT_A_DEVICE_LIST',
  TOO_MANY_DEVICES: 'TOO_MANY_DEVICES',
} as const;
export type MacosUsbTreeRefusal = (typeof MacosUsbTreeRefusal)[keyof typeof MacosUsbTreeRefusal];

/** One USB device with an audio streaming interface. Integers, and text that has passed its rule - but for `productName`. */
export interface MacosUsbAudioDevice {
  readonly vendorId: number;
  readonly productId: number;
  readonly locationId: number;
  /** `vvvv:pppp`, written from the two integers. */
  readonly usbId: string;
  /** The location as eight lower-case hexadecimal digits, written from the integer: the port path of macOS. */
  readonly usbPort: string;
  /** The serial through the rule of its kind, or null: none stated, or a text outside the rule (then NO serial, never a cleaned one). */
  readonly usbSerial: string | null;
  /** RAW device text, or null when the device states none. For the tie's comparison only: never shown, stored or logged. */
  readonly productName: string | null;
}

export type MacosUsbTree =
  | { readonly ok: true; readonly audioDevices: readonly MacosUsbAudioDevice[]; /** Device dictionaries of the text. */ readonly devices: number; /** Devices refused (see the head of the file). */ readonly refused: number }
  | { readonly ok: false; readonly reason: MacosUsbTreeRefusal; readonly detail?: PlistRefusal };

const hex = (value: number, digits: number): string => value.toString(16).padStart(digits, '0');
const integerOf = (value: PlistValue | undefined, min: number, max: number): number | null =>
  value !== undefined && value.kind === 'integer' && value.value !== null && value.value >= min && value.value <= max ? value.value : null;

type Read = { readonly state: 'AUDIO'; readonly device: MacosUsbAudioDevice } | { readonly state: 'NOT_AUDIO'; readonly locationId: number | null } | { readonly state: 'REFUSED'; readonly locationId: number | null };

/** True, false, or null when the children cannot be read as the form states them. */
function hasAudioStreaming(children: PlistValue | undefined): boolean | null {
  if (children === undefined) return false;
  if (children.kind !== 'array') return null;
  let audio = false;
  for (const child of children.items) {
    if (child.kind !== 'dict') return null;
    const classValue = child.members.get('bInterfaceClass');
    const subClassValue = child.members.get('bInterfaceSubClass');
    if (classValue === undefined && subClassValue === undefined) continue;
    const interfaceClass = integerOf(classValue, 0, 255);
    const subClass = integerOf(subClassValue, 0, 255);
    if (interfaceClass === null || subClass === null) return null;
    if (interfaceClass === 1 && subClass === 2) audio = true;
  }
  return audio;
}

function readDevice(members: ReadonlyMap<string, PlistValue>): Read {
  const locationId = integerOf(members.get('locationID'), 1, 0xffff_ffff);
  const audio = hasAudioStreaming(members.get('IORegistryEntryChildren'));
  if (audio === false) return { state: 'NOT_AUDIO', locationId };
  const refused: Read = { state: 'REFUSED', locationId };
  if (audio === null) return refused;
  const vendorId = integerOf(members.get('idVendor'), 1, 0xffff);
  const productId = integerOf(members.get('idProduct'), 0, 0xffff);
  const stated = members.get('IORegistryEntryLocation');
  if (vendorId === null || productId === null || locationId === null) return refused;
  if (stated === undefined || stated.kind !== 'string' || !/^[0-9A-Fa-f]{8}$/.test(stated.value) || Number.parseInt(stated.value, 16) !== locationId) return refused;
  const serial = members.get('USB Serial Number');
  const product = members.get('USB Product Name');
  if ((serial !== undefined && serial.kind !== 'string') || (product !== undefined && product.kind !== 'string')) return refused;
  return {
    state: 'AUDIO',
    device: Object.freeze({
      vendorId,
      productId,
      locationId,
      usbId: `${hex(vendorId, 4)}:${hex(productId, 4)}`,
      usbPort: hex(locationId, 8),
      usbSerial: serial === undefined ? null : cardListingText(CardStringKind.USB_SERIAL, serial.value),
      productName: product === undefined ? null : product.value,
    }),
  };
}

/** Reads the output of the USB tree row. See the head of the file for every rule. */
export function parseMacosUsbTree(text: unknown): MacosUsbTree {
  if (text === '') return Object.freeze({ ok: true, audioDevices: Object.freeze([]), devices: 0, refused: 0 });
  const parsed = parseMacosPlist(text);
  if (!parsed.ok) return Object.freeze({ ok: false, reason: MacosUsbTreeRefusal.NOT_A_PROPERTY_LIST, detail: parsed.reason });
  const top = parsed.value;
  if (top.kind !== 'array' || top.items.some((item) => item.kind !== 'dict')) return Object.freeze({ ok: false, reason: MacosUsbTreeRefusal.NOT_A_DEVICE_LIST });
  if (top.items.length > MACOS_USB_TREE_MAX_DEVICES) return Object.freeze({ ok: false, reason: MacosUsbTreeRefusal.TOO_MANY_DEVICES });
  const reads = top.items.map((item) => (item.kind === 'dict' ? readDevice(item.members) : ({ state: 'REFUSED', locationId: null } as Read)));
  const stated = new Map<number, number>();
  for (const read of reads) {
    const location = read.state === 'AUDIO' ? read.device.locationId : read.locationId;
    if (location !== null) stated.set(location, (stated.get(location) ?? 0) + 1);
  }
  const audioDevices: MacosUsbAudioDevice[] = [];
  let refused = 0;
  for (const read of reads) {
    if (read.state === 'REFUSED') refused += 1;
    else if (read.state === 'AUDIO') {
      // A location stated by two devices of one tree is the place of neither.
      if ((stated.get(read.device.locationId) ?? 0) > 1) refused += 1;
      else audioDevices.push(read.device);
    }
  }
  return Object.freeze({ ok: true, audioDevices: Object.freeze(audioDevices), devices: reads.length, refused });
}
