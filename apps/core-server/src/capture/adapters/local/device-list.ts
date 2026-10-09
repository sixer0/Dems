/**
 * The device list and the exact-name rule (blueprint row 134; capture spec §A.6.4 "Device
 * selection", HL-10, erratum PE-128-63; SEC35-43; check `M4-SEC-HELPER-1`).
 *
 * The list is what the helper program prints for `-list_devices true`. Listing opens no device
 * and asks for no permission. It is read before EVERY open, and the helper is started only when
 * `selectLocalDevice` says so.
 *
 * WHY EQUALITY IS NOT ENOUGH. The device layer of the helper program does not compare names for
 * equality: it takes the first device whose name BEGINS with the text it was given, reads a text
 * that begins with a number as an index, knows the keywords `default` and `none`, and matches a
 * screen capture by its own name pattern. So a name is refused when it could be read as any of
 * those, and a list is refused when any OTHER entry begins with the name.
 */

export interface LocalDeviceList {
  readonly video: readonly string[];
  readonly audio: readonly string[];
}

const SECTION = /AVFoundation (video|audio) devices:\s*$/;
const ENTRY = /^\[[^\]]*\]\s+\[(\d+)\]\s(.*)$/;
/** At most this many entries per class and this many characters per name are read. */
const MAX_ENTRIES = 64;
export const LOCAL_DEVICE_NAME_MAX = 120;

/** Reads the list from the helper's diagnostics. Text that is no list gives two empty classes. */
export function parseDeviceList(diagnostics: string): LocalDeviceList {
  const video: string[] = [];
  const audio: string[] = [];
  let into: string[] | null = null;
  for (const raw of diagnostics.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const section = SECTION.exec(line);
    if (section !== null) {
      into = section[1] === 'video' ? video : audio;
      continue;
    }
    const entry = ENTRY.exec(line);
    if (entry === null || into === null) continue;
    const name = entry[2] ?? '';
    if (into.length < MAX_ENTRIES && name.length > 0 && name.length <= LOCAL_DEVICE_NAME_MAX) into.push(name);
  }
  return { video: Object.freeze(video), audio: Object.freeze(audio) };
}

/** Letters, digits, spaces and a few marks; it starts with a letter. No separator, no option dash at the start, no shell mark. */
const NAME_SHAPE = /^[A-Za-z][A-Za-z0-9 ._()+'-]*$/;
/** What the device layer reads as something other than a device name, compared without case. */
const RESERVED_PREFIX = ['default', 'none', 'capture screen'];

/** True when `name` can be handed to the helper as a device name and as nothing else. */
export function isUsableDeviceName(name: string): boolean {
  if (name.length === 0 || name.length > LOCAL_DEVICE_NAME_MAX) return false;
  if (!NAME_SHAPE.test(name) || name !== name.trim()) return false;
  const lower = name.toLowerCase();
  return !RESERVED_PREFIX.some((prefix) => lower.startsWith(prefix));
}

export type DeviceSelection = { readonly ok: true; readonly name: string } | { readonly ok: false; readonly reason: 'NAME_NOT_ALLOWED' | 'NAME_ABSENT' | 'NAME_AMBIGUOUS' };

/**
 * The rule: the device is opened only when EXACTLY ONE listed entry of its class equals the
 * configured name (string equality, no trimming, no case folding) and no other entry of that
 * class begins with it.
 */
export function selectLocalDevice(entries: readonly string[], name: string): DeviceSelection {
  if (!isUsableDeviceName(name)) return { ok: false, reason: 'NAME_NOT_ALLOWED' };
  const equal = entries.filter((entry) => entry === name).length;
  if (equal === 0) return { ok: false, reason: 'NAME_ABSENT' };
  const beginning = entries.filter((entry) => entry.startsWith(name)).length;
  if (equal !== 1 || beginning !== 1) return { ok: false, reason: 'NAME_AMBIGUOUS' };
  return { ok: true, name };
}
