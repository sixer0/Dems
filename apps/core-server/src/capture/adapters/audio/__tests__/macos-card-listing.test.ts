// The card listing of a macOS host (task 4 row N6; design masterplan/06 sections 2 and 3; review
// SM-01, SM-02 (gate), SM-03, SM-05, SM-11, SM-13, SM-22, SM-25).
//
// THE DOUBLE. No process is started and no device is opened: the three texts are FIXED TEXTS, the
// files under `fixtures/macos/` written by hand in the forms row MM measured (and compared once,
// by shape, with what this Mac prints), and texts a small writer of this file makes in the same
// forms for the cases that differ in one member. EVERY name, serial and location is synthetic.
// What this proves is the READERS and the TIE: what they make of a text, what they refuse, that
// nothing a device announced leaves them unchecked, and that the identity they write is found by
// the EXISTING match (`identifyRegisteredCard`, unedited). What a real host prints with a hostile
// device connected, and whether a location survives a reboot, is proven on hardware.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPTURE_AUDIO_CARD_ID_PATTERN, CAPTURE_AUDIO_USB_ID_PATTERN, CAPTURE_AUDIO_USB_PORT_PATTERN, CAPTURE_AUDIO_USB_SERIAL_PATTERN } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { CARD_LISTING_LIMITS, CARD_USB_ID_REPLACEMENT, CardFactsSource, CardStringKind, cardListingText, type CaptureCard } from '../card-listing';
import {
  MACOS_CARD_LISTING_UNDECIDED,
  MacosCardListingError,
  MacosListingFailure,
  createMacosCardEnumerator,
  readMacosListing,
  type MacosListingSource,
  type MacosTiedListing,
} from '../macos-card-listing';
import { MacosUndecidedReason, isTieableName, tieMacosLists } from '../macos-card-tie';
import { MacosHelperListRefusal, parseMacosHelperList } from '../macos-helper-list-reader';
import { MACOS_PLIST_LIMITS, PlistRefusal, parseMacosPlist, type PlistValue } from '../macos-plist';
import { MACOS_SYSTEM_AUDIO_LIMITS, MacosSystemAudioRefusal, parseMacosSystemAudio, parseStrictJson } from '../macos-system-audio-reader';
import { MacosUsbTreeRefusal, parseMacosUsbTree } from '../macos-usb-tree-reader';
import { CardMismatch, UsbAudioRefusal, identifyRegisteredCard, isRegisteredAudioInput, type RegisteredAudioInput } from '../usb-audio-production';

// ── The fixed texts ───────────────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const fx = (name: string): string => readFileSync(resolve(HERE, 'fixtures', 'macos', `${name}.txt`), 'utf8');
const set = (name: string, tree = name): readonly [string, string, string] => [fx(`tree-${tree}`), fx(`system-${name}`), fx(`helper-${name}`)];

/** 4 KiB of printable text for the marker of the hostile fixture: longer than any line a listing reads. */
const FOUR_KIB = 'DEMS-LONG-'.repeat(410).slice(0, 4096);

// ── A writer of the three forms, for the cases that differ in one member ─────────────────────

const PLIST_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n';
const PLIST_FOOT = '\n</plist>\n';
const plist = (body: string): string => `${PLIST_HEAD}${body}${PLIST_FOOT}`;
const xml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface TreeDevice {
  readonly vendor?: number;
  readonly product?: number;
  readonly location: number;
  readonly name?: string | null;
  readonly serial?: string | null;
  /** Interface (class, sub-class) pairs of the direct children. Default: one audio streaming interface. */
  readonly interfaces?: readonly (readonly [number, number])[];
  /** Raw members that REPLACE the written one of the same key, or are added. */
  readonly raw?: Readonly<Record<string, string>>;
}
const deviceDict = (device: TreeDevice): string => {
  const children = (device.interfaces ?? [[1, 2]]).map(([c, s]) => `<dict><key>bInterfaceClass</key><integer>${c}</integer><key>bInterfaceSubClass</key><integer>${s}</integer></dict>`);
  const members: Record<string, string> = {
    IORegistryEntryChildren: `<array><dict><key>IOClass</key><string>SyntheticDriverNode</string></dict>${children.join('')}</array>`,
    IORegistryEntryLocation: `<string>${device.location.toString(16).padStart(8, '0')}</string>`,
    ...(device.name === null ? {} : { 'USB Product Name': `<string>${xml(device.name ?? 'DEMS Hexa 6')}</string>` }),
    ...(device.serial === null || device.serial === undefined ? {} : { 'USB Serial Number': `<string>${xml(device.serial)}</string>` }),
    idProduct: `<integer>${device.product ?? 6}</integer>`,
    idVendor: `<integer>${device.vendor ?? 0x1a2b}</integer>`,
    locationID: `<integer>${device.location}</integer>`,
    ...(device.raw ?? {}),
  };
  return `<dict>${Object.entries(members)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `<key>${xml(key)}</key>${value}`)
    .join('\n')}</dict>`;
};
const treeOf = (devices: readonly TreeDevice[]): string => plist(`<array>\n${devices.map(deviceDict).join('\n')}\n</array>`);

interface SystemItem {
  readonly name: string;
  /** Written as given: a number, or raw JSON text for a count of another type. Undefined: no input. */
  readonly inputs?: number | string;
  readonly rate?: number | string;
  /** Undefined: the USB word. Null: no transport member. */
  readonly transport?: string | null;
}
const systemOf = (items: readonly SystemItem[]): string =>
  `{\n  "SPAudioDataType" : [\n    {\n      "_items" : [\n${items
    .map((item) => {
      const members = [`"_name" : ${JSON.stringify(item.name)}`];
      if (item.inputs !== undefined) members.push(`"coreaudio_device_input" : ${item.inputs}`);
      members.push(`"coreaudio_device_srate" : ${item.rate ?? 48000}`);
      if (item.transport !== null) members.push(`"coreaudio_device_transport" : ${JSON.stringify(item.transport ?? 'coreaudio_device_type_usb')}`);
      return `        { ${members.join(', ')} }`;
    })
    .join(',\n')}\n      ],\n      "_name" : "coreaudio_device"\n    }\n  ]\n}`;

const TAG = '[AVFoundation indev @ 0x7f8a5c004a00]';
const HELPER_END = '[in#0 @ 0x7f8a5c005100] Error opening input: Input/output error\nError opening input file .\nError opening input files: Input/output error\n';
const helperLines = (lines: readonly string[]): string => `${TAG} AVFoundation video devices:\n${TAG} [0] DEMS Synthetic Camera\n${TAG} AVFoundation audio devices:\n${lines.map((line) => `${line}\n`).join('')}${HELPER_END}`;
const helperOf = (names: readonly string[]): string => helperLines(names.map((name, index) => `${TAG} [${index}] ${name}`));

// Synthetic places: 0x01120000, 0x01140000, 0x02100000.
const PORT_A = 0x0112_0000;
const PORT_B = 0x0114_0000;
const PORT_C = 0x0210_0000;
const HEXA = 'DEMS Hexa 6';
const BUILT_IN: SystemItem = { name: 'DEMS Built-in Input', inputs: 1, transport: 'coreaudio_device_type_builtin' };

const tied = (tree: string, system: string, helper: string): Extract<MacosTiedListing, { ok: true }> => {
  const result = readMacosListing(tree, system, helper);
  if (!result.ok) throw new Error(`the listing was expected to be readable: ${result.failure} ${result.detail}`);
  return result;
};
/** One USB interface beside a built-in input, with one member of the three texts changed by the caller. */
const one = (device: Partial<TreeDevice> = {}, item: Partial<SystemItem> | null = {}, names: readonly string[] | null = null) => {
  const name = device.name === undefined ? HEXA : device.name;
  const items = item === null ? [BUILT_IN] : [{ name: name ?? HEXA, inputs: 6, ...item }, BUILT_IN];
  return tied(treeOf([{ location: PORT_A, ...device }]), systemOf(items), helperOf(names ?? [BUILT_IN.name, ...(item === null ? [] : [items[0]?.name ?? HEXA])]));
};
const reasons = (result: Extract<MacosTiedListing, { ok: true }>): string[] => result.undecided.map((device) => device.reason);
const sourceOf = (tree: string, system: string, helper: string): MacosListingSource => ({ usbTree: async () => tree, systemAudio: async () => system, captureDevices: async () => helper });

// ── 1. The property-list reader ───────────────────────────────────────────────────────────────

describe('the property-list reader: the strict subset, bounded, nothing evaluated', () => {
  const dictOf = (value: PlistValue | undefined): ReadonlyMap<string, PlistValue> => {
    if (value === undefined || value.kind !== 'dict') throw new Error('a dictionary was expected');
    return value.members;
  };

  it('reads the form of the fixture: integers are integers, a string is one element, a data element and a truth value are passed over by type', () => {
    const parsed = parseMacosPlist(fx('tree-one-interface'));
    if (!parsed.ok || parsed.value.kind !== 'array') throw new Error('the fixture is a list');
    expect(parsed.value.items.map((item) => item.kind)).toEqual(['dict', 'dict', 'dict']);
    const device = dictOf(parsed.value.items[1]);
    expect(device.get('locationID')).toEqual({ kind: 'integer', value: 17956864 });
    expect(device.get('USB Product Name')).toEqual({ kind: 'string', value: 'DEMS Hexa 6' });
    expect(dictOf(device.get('IOPowerManagement')).get('PowerOverrideOn')).toEqual({ kind: 'other' });
    expect(dictOf(parsed.value.items[2]).get('SyntheticDescriptor')).toEqual({ kind: 'other' });
    // An integer beyond the exact whole numbers is an integer of the text and no number.
    expect(parseMacosPlist(plist('<integer>18446744073709551615</integer>'))).toEqual({ ok: true, value: { kind: 'integer', value: null } });
    expect(parseMacosPlist(plist('<array/>'))).toEqual({ ok: true, value: { kind: 'array', items: [] } });
  });

  it('SM-02: a string that holds the text of a key, a closing tag and a forged header is ONE string - the five entities and no other', () => {
    const parsed = parseMacosPlist(fx('tree-hostile-strings').replace('@@FOUR_KIB@@', FOUR_KIB));
    if (!parsed.ok || parsed.value.kind !== 'array') throw new Error('the fixture is a list');
    expect(parsed.value.items).toHaveLength(4);
    const forged = dictOf(parsed.value.items[1]);
    // The real location, as an integer; the forged one is text inside the name.
    expect(forged.get('locationID')).toEqual({ kind: 'integer', value: 17956864 });
    expect(forged.get('USB Product Name')).toEqual({ kind: 'string', value: 'X</string><key>locationID</key><integer>34603008</integer><key>IORegistryEntryLocation</key><string>02100000' });
    expect(dictOf(parsed.value.items[0]).get('USB Product Name')).toEqual({ kind: 'string', value: '<b>DEMS</b> & <script>x()</script>' });
    expect(dictOf(parsed.value.items[2]).get('USB Product Name')).toEqual({ kind: 'string', value: FOUR_KIB });
    expect(parseMacosPlist(plist('<string>&quot;a&apos; &lt;&gt;&amp;</string>'))).toEqual({ ok: true, value: { kind: 'string', value: '"a\' <>&' } });
  });

  it('refuses, each with its word: another head, a declared entity, a reference, markup outside the set, a key twice, a number of another form, the bounds', () => {
    const refusal = (text: unknown): string => {
      const parsed = parseMacosPlist(text);
      return parsed.ok ? 'READ' : parsed.reason;
    };
    // A document type with an internal subset and entity declarations (a nested expansion, an external place): the head is not the fixed one; nothing is expanded.
    expect(refusal(fx('tree-entity-declaration'))).toBe(PlistRefusal.HEAD);
    expect(refusal(`<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<array/>${PLIST_FOOT}`)).toBe(PlistRefusal.HEAD);
    expect(refusal(`﻿${plist('<array/>')}`)).toBe(PlistRefusal.HEAD);
    for (const entity of ['&c;', '&#65;', '&#x41;', '&place;', '&', '&amp', '&nbsp;']) expect(refusal(plist(`<string>a${entity}b</string>`)), entity).toBe(PlistRefusal.ENTITY);
    expect(refusal(plist('<dict><key>a&c;</key><true/></dict>'))).toBe(PlistRefusal.ENTITY);
    for (const markup of [
      '<!-- a --><array/>',
      '<?pi a?><array/>',
      '<string><![CDATA[a]]></string>',
      '<array version="1"></array>',
      '<string xml:space="preserve">a</string>',
      '<set/>',
      '<array><string>a</string>b</array>',
      'a<array/>',
      '<array/><array/>',
      '<array/>a',
      '<array><string>a</integer></array>',
      '<array><string>a<b>c</b></string></array>',
      '<dict><string>a</string></dict>',
      '<dict><key>a</key></dict>',
      '<array><!DOCTYPE a></array>',
      '<array>',
      '',
    ]) {
      expect(refusal(plist(markup)), markup).toBe(PlistRefusal.MARKUP);
    }
    expect(refusal(plist('<dict><key>a</key><true/><key>a</key><false/></dict>'))).toBe(PlistRefusal.KEY);
    expect(refusal(plist('<dict><key></key><true/></dict>'))).toBe(PlistRefusal.KEY);
    expect(refusal(plist(`<dict><key>${'k'.repeat(MACOS_PLIST_LIMITS.keyCharacters + 1)}</key><true/></dict>`))).toBe(PlistRefusal.KEY);
    for (const number of ['0x10', '1.0', ' 1', '1 ', '', '+1', '1e3', '१']) expect(refusal(plist(`<integer>${number}</integer>`)), number).toBe(PlistRefusal.VALUE);
    expect(refusal(plist('<real>a</real>'))).toBe(PlistRefusal.VALUE);
    expect(refusal(plist('<data>!</data>'))).toBe(PlistRefusal.VALUE);
    // Depth: twelve nested lists are read, thirteen are not.
    const nested = (depth: number): string => plist(`${'<array>'.repeat(depth)}${'</array>'.repeat(depth)}`);
    expect(refusal(nested(MACOS_PLIST_LIMITS.depth))).toBe('READ');
    expect(refusal(nested(MACOS_PLIST_LIMITS.depth + 1))).toBe(PlistRefusal.DEPTH);
    // Count: a text inside the size bound whose elements are beyond the count bound.
    const many = plist(`<array>${'<a/>'.replace('a', 'true').repeat(MACOS_PLIST_LIMITS.nodes)}</array>`);
    expect(many.length).toBeLessThan(MACOS_PLIST_LIMITS.textCharacters);
    expect(refusal(many)).toBe(PlistRefusal.NODES);
    // Size: one character over the bound is not read at all; the bound itself is.
    const filler = (length: number): string => plist(`<string>${'a'.repeat(length - PLIST_HEAD.length - PLIST_FOOT.length - 17)}</string>`);
    // MOVED BY ROW N5b (decision C131 (2)): the bound is the USB tree row's 512 KiB (was 65,536).
    expect(filler(MACOS_PLIST_LIMITS.textCharacters)).toHaveLength(524_288);
    expect(refusal(filler(MACOS_PLIST_LIMITS.textCharacters))).toBe('READ');
    expect(refusal(filler(MACOS_PLIST_LIMITS.textCharacters + 1))).toBe(PlistRefusal.TOO_LONG);
    for (const other of [null, undefined, 7, {}, ['<array/>']]) expect(refusal(other)).toBe(PlistRefusal.NOT_TEXT);
  });

  it('a CUT text is never read: no proper beginning of the fixture gives a value', () => {
    const whole = fx('tree-one-interface');
    expect(parseMacosPlist(whole).ok).toBe(true);
    const read: number[] = [];
    for (let length = 0; length < whole.length; length += 1) if (parseMacosPlist(whole.slice(0, length)).ok) read.push(length);
    expect(read).toEqual([]);
    expect(parseMacosPlist(whole.slice(0, -1))).toEqual({ ok: false, reason: PlistRefusal.FOOT });
    expect(parseMacosPlist(`${whole}\n`)).toEqual({ ok: false, reason: PlistRefusal.FOOT });
  });

  // Row N5b (decision C131 (2)). Seen RED on: the reader's bound written as 65,536 again (out of step with the row's cap); the
  // element count left at 8,192 (the tree of 512 KiB refused `NODES`).
  it('row N5b: the reader\'s bound IS the USB tree row\'s cap (one constant, 512 KiB); a tree of the measured form near the bound is read, in time linear in its size', async () => {
    const { MACOS_LISTING_ROW_LIMITS } = await import('../../../fence/production-parts');
    expect(MACOS_LISTING_ROW_LIMITS.USB_TREE.capBytes).toBe(MACOS_PLIST_LIMITS.textCharacters);
    expect([MACOS_PLIST_LIMITS.textCharacters, MACOS_PLIST_LIMITS.nodes]).toEqual([524_288, 65_536]);
    // A synthetic tree: the fixture's device list repeated until the size asked (the reader needs no distinct devices).
    const whole = fx('tree-one-interface');
    const open = whole.indexOf('<array>') + '<array>'.length;
    const close = whole.lastIndexOf('</array>');
    const devices = whole.slice(open, close);
    const tree = (size: number): string => {
      const copies = Math.floor((size - (whole.length - devices.length)) / devices.length);
      return `${whole.slice(0, open)}${devices.repeat(copies)}${whole.slice(close)}`;
    };
    const small = tree(128 * 1024);
    const large = tree(MACOS_PLIST_LIMITS.textCharacters);
    expect(large.length).toBeLessThanOrEqual(MACOS_PLIST_LIMITS.textCharacters);
    expect(large.length).toBeGreaterThan(MACOS_PLIST_LIMITS.textCharacters - devices.length - 1);
    expect([parseMacosPlist(small).ok, parseMacosPlist(large).ok]).toEqual([true, true]);
    const median = (text: string): number => {
      const times: number[] = [];
      for (let run = 0; run < 7; run += 1) {
        const start = performance.now();
        parseMacosPlist(text);
        times.push(performance.now() - start);
      }
      return times.sort((a, b) => a - b)[3] ?? Number.POSITIVE_INFINITY;
    };
    // Four times the text: linear is about four times the time (measured 1.2 ms and 4.6 ms on this Mac); quadratic would be sixteen.
    expect(median(large) / Math.max(median(small), 0.05)).toBeLessThan(9);
  });
});

// ── 2. The USB tree ───────────────────────────────────────────────────────────────────────────

describe('the USB tree: the identity from integers, by type, a doubt refuses the device', () => {
  const audio = (text: string) => {
    const tree = parseMacosUsbTree(text);
    if (!tree.ok) throw new Error(`the tree was expected to be readable: ${tree.reason}`);
    return tree;
  };

  it('the fixture: three devices, ONE with an audio streaming interface; children without interface keys are passed over; a network device with a serial is no audio device', () => {
    expect(audio(fx('tree-one-interface'))).toEqual({
      ok: true,
      devices: 3,
      refused: 0,
      audioDevices: [{ vendorId: 0x1a2b, productId: 6, locationId: PORT_A, usbId: '1a2b:0006', usbPort: '01120000', usbSerial: null, productName: 'DEMS Hexa 6' }],
    });
    // A device with the control interface only (class 1, sub-class 1) is no audio streaming device.
    expect(audio(treeOf([{ location: PORT_A, interfaces: [[1, 1], [3, 0]] }])).audioDevices).toEqual([]);
    // No children at all (the form one measurement showed at depth 2): no audio device is CLAIMED.
    expect(audio(treeOf([{ location: PORT_A, raw: { IORegistryEntryChildren: '' } }]))).toMatchObject({ audioDevices: [], refused: 0 });
    // An empty text is a host with no USB device.
    expect(parseMacosUsbTree('')).toEqual({ ok: true, audioDevices: [], devices: 0, refused: 0 });
  });

  it('the identity is written from the integers and is inside the forms the contract and the column hold; a serial outside the rule is NO serial', () => {
    const [device] = audio(treeOf([{ vendor: 0x00ab, product: 0, location: 0x0000_0001, serial: 'SN-SYN.0001:a_b' }])).audioDevices;
    expect(device).toMatchObject({ usbId: '00ab:0000', usbPort: '00000001', usbSerial: 'SN-SYN.0001:a_b' });
    const [top] = audio(treeOf([{ vendor: 0xffff, product: 0xffff, location: 0xffff_ffff }])).audioDevices;
    expect(top).toMatchObject({ usbId: 'ffff:ffff', usbPort: 'ffffffff' });
    for (const id of [device, top]) {
      expect(id?.usbId).toMatch(CAPTURE_AUDIO_USB_ID_PATTERN);
      expect(id?.usbPort).toMatch(CAPTURE_AUDIO_USB_PORT_PATTERN);
      expect(cardListingText(CardStringKind.USB_PORT, id?.usbPort)).toBe(id?.usbPort);
      expect(cardListingText(CardStringKind.CARD_ID, `usb_${id?.usbPort}`)).toBe(`usb_${id?.usbPort}`);
    }
    for (const serial of ['SN 0001', 'SN<0001>', 'Sérial', 'a'.repeat(65), '', 'a\nb']) {
      expect(audio(treeOf([{ location: PORT_A, serial }])).audioDevices[0]?.usbSerial, serial).toBeNull();
    }
    // The fixture of the hostile strings: a serial of markup is no serial; the device keeps its real place.
    expect(audio(fx('tree-hostile-strings')).audioDevices.map((d) => [d.usbId, d.usbPort, d.usbSerial])).toEqual([
      ['1a2b:00a1', '01110000', null],
      ['1a2b:00a2', '01120000', null],
      ['1a2b:00a4', '01140000', null],
      ['1a2b:0006', '02100000', null],
    ]);
  });

  it('the typed twins of the forged text: a key of another type, a location that differs from the registry location, 0, out of range, missing - each refuses the device, counted', () => {
    const refusedBy = (raw: Record<string, string>, device: Partial<TreeDevice> = {}): unknown => {
      const tree = audio(treeOf([{ location: PORT_A, ...device, raw }, { location: PORT_C, name: 'DEMS Solo 1' }]));
      return [tree.audioDevices.map((d) => d.usbPort), tree.refused];
    };
    const REFUSED = [['02100000'], 1];
    expect(refusedBy({})).toEqual([['01120000', '02100000'], 0]);
    const twins: readonly Record<string, string>[] = [
      { locationID: '<string>17956864</string>' },
      { locationID: '<real>17956864</real>' },
      { locationID: '<integer>0</integer>' },
      { locationID: '<integer>-1</integer>' },
      { locationID: '<integer>4294967296</integer>' },
      { locationID: '' },
      // The header location of the text form: here a member that must state the same number.
      { IORegistryEntryLocation: '<string>02100001</string>' },
      { IORegistryEntryLocation: '<string>1120000</string>' },
      { IORegistryEntryLocation: '<string>0x112000</string>' },
      { IORegistryEntryLocation: '<integer>17956864</integer>' },
      { IORegistryEntryLocation: '' },
      { idVendor: '<string>6699</string>' },
      { idVendor: '<integer>0</integer>' },
      { idVendor: '<integer>65536</integer>' },
      { idVendor: '' },
      { idProduct: '<integer>65536</integer>' },
      { idProduct: '<true/>' },
      { idProduct: '' },
      { 'USB Serial Number': '<integer>7</integer>' },
      { 'USB Product Name': '<array><string>DEMS</string></array>' },
      // Children that are not of the form: whether the device is an audio device cannot be said.
      { IORegistryEntryChildren: '<dict/>' },
      { IORegistryEntryChildren: '<array><string>a</string></array>' },
      { IORegistryEntryChildren: '<array><dict><key>bInterfaceClass</key><integer>1</integer></dict></array>' },
      { IORegistryEntryChildren: '<array><dict><key>bInterfaceClass</key><integer>1</integer><key>bInterfaceSubClass</key><string>2</string></dict></array>' },
      { IORegistryEntryChildren: '<array><dict><key>bInterfaceClass</key><integer>256</integer><key>bInterfaceSubClass</key><integer>2</integer></dict></array>' },
    ];
    for (const raw of twins) expect(refusedBy(raw), JSON.stringify(raw)).toEqual(REFUSED);
    // A device that is NO audio device is not judged: its own members are not this listing's business.
    expect(refusedBy({ idVendor: '<string>x</string>' }, { interfaces: [[9, 0]] })).toEqual([['02100000'], 0]);
  });

  it('SM-02 (4): a location stated by two devices of one tree refuses BOTH audio devices - also when the other is no audio device', () => {
    expect(audio(treeOf([{ location: PORT_A }, { location: PORT_A, name: 'DEMS Solo 1', product: 1 }, { location: PORT_C, name: 'DEMS Duo 2' }]))).toMatchObject({ refused: 2, audioDevices: [{ usbPort: '02100000' }] });
    expect(audio(treeOf([{ location: PORT_A }, { location: PORT_A, interfaces: [[9, 0]] }]))).toMatchObject({ refused: 1, audioDevices: [] });
  });

  it('the whole tree is undecided, with a closed word: no property list, a forged member that is NOT escaped, another top, more than 32 devices', () => {
    // The device's string closes its own element and states a second location: a key twice, and the tree is not read at all.
    expect(parseMacosUsbTree(fx('tree-forged-unescaped'))).toEqual({ ok: false, reason: MacosUsbTreeRefusal.NOT_A_PROPERTY_LIST, detail: PlistRefusal.KEY });
    expect(parseMacosUsbTree(fx('tree-entity-declaration'))).toEqual({ ok: false, reason: MacosUsbTreeRefusal.NOT_A_PROPERTY_LIST, detail: PlistRefusal.HEAD });
    expect(parseMacosUsbTree(fx('tree-one-interface').slice(0, 2000))).toEqual({ ok: false, reason: MacosUsbTreeRefusal.NOT_A_PROPERTY_LIST, detail: PlistRefusal.FOOT });
    expect(parseMacosUsbTree(plist('<dict/>'))).toEqual({ ok: false, reason: MacosUsbTreeRefusal.NOT_A_DEVICE_LIST });
    expect(parseMacosUsbTree(plist('<array><dict/><string>a</string></array>'))).toEqual({ ok: false, reason: MacosUsbTreeRefusal.NOT_A_DEVICE_LIST });
    const devices = (count: number): TreeDevice[] => Array.from({ length: count }, (_, index) => ({ location: PORT_A + index, interfaces: [[9, 0]] as const }));
    expect(parseMacosUsbTree(treeOf(devices(32)))).toMatchObject({ ok: true, devices: 32 });
    expect(parseMacosUsbTree(treeOf(devices(33)))).toEqual({ ok: false, reason: MacosUsbTreeRefusal.TOO_MANY_DEVICES });
    expect(parseMacosUsbTree(null)).toEqual({ ok: false, reason: MacosUsbTreeRefusal.NOT_A_PROPERTY_LIST, detail: PlistRefusal.NOT_TEXT });
  });
});

// ── 3. The system list ────────────────────────────────────────────────────────────────────────

describe('the system list: bounded JSON, four members by type, nothing rounded', () => {
  const items = (text: string) => {
    const system = parseMacosSystemAudio(text);
    if (!system.ok) throw new Error(`the system list was expected to be readable: ${system.reason}`);
    return system.items;
  };

  it('the fixture: the USB interface with six inputs, the built-in input, an output that is no input; the manufacturer and the source are not read', () => {
    expect(items(fx('system-one-interface'))).toEqual([
      { name: 'DEMS Hexa 6', input: true, readable: true, inputChannels: 6, rateHz: 48000, usb: true },
      { name: 'DEMS Built-in Input', input: true, readable: true, inputChannels: 1, rateHz: 48000, usb: false },
      { name: 'DEMS Built-in Output', input: false, readable: true, inputChannels: null, rateHz: null, usb: false },
    ]);
    expect(JSON.stringify(items(fx('system-one-interface')))).not.toMatch(/Maker|Works|Source|Speakers/);
  });

  it('SM-11: a count or a rate that is not an INTEGER of its range makes the item unreadable - a float and a string are never rounded', () => {
    const read = (item: Partial<SystemItem>): unknown => {
      const [first] = items(systemOf([{ name: HEXA, inputs: 6, ...item }]));
      return [first?.input, first?.readable, first?.inputChannels, first?.rateHz];
    };
    expect(read({})).toEqual([true, true, 6, 48000]);
    expect(read({ inputs: 64, rate: 8000 })).toEqual([true, true, 64, 8000]);
    expect(read({ inputs: 1, rate: 192000 })).toEqual([true, true, 1, 192000]);
    for (const inputs of ['6.0', '6.5', '"6"', '0', '65', '-1', '6e0', 'null', 'true', '[6]', '1e2']) expect(read({ inputs }), inputs).toEqual([true, false, null, null]);
    for (const rate of ['48000.0', '"48000"', '7999', '192001', '4.8e4', 'null']) expect(read({ rate }), rate).toEqual([true, false, null, null]);
    // A transport word that is missing, unknown, or no string: not USB.
    for (const transport of [null, 'coreaudio_device_type_builtin', 'coreaudio_device_type_usb ', 'COREAUDIO_DEVICE_TYPE_USB', 'usb', '']) {
      expect(items(systemOf([{ name: HEXA, inputs: 6, transport }]))[0]?.usb, String(transport)).toBe(false);
    }
    expect(items('{"SPAudioDataType":[{"_items":[{"_name":"a","coreaudio_device_input":2,"coreaudio_device_srate":48000,"coreaudio_device_transport":["coreaudio_device_type_usb"]}]}]}')[0]?.usb).toBe(false);
  });

  it('SM-13: an EMPTY list is a list of no item (the confined answer), in each of its forms - and is not another shape', () => {
    for (const empty of ['{"SPAudioDataType":[]}', '{\n  "SPAudioDataType" : [\n\n  ]\n}', '{"SPAudioDataType":[{"_name":"coreaudio_device"}]}', '{"SPAudioDataType":[{"_items":[]}]}']) {
      expect(parseMacosSystemAudio(empty), empty).toEqual({ ok: true, items: [] });
    }
  });

  it('refuses the whole list, each with its word: another shape, an item that is no object or has no name, more than 32 items, a key twice, a cut or over-long text', () => {
    const refusal = (text: unknown): string => {
      const system = parseMacosSystemAudio(text);
      return system.ok ? 'READ' : system.reason;
    };
    for (const shape of ['[]', '{}', '{"SPAudioDataType":{}}', '{"SPAudioDataType":[[]]}', '{"SPAudioDataType":[{"_items":{}}]}', '{"SPAudioDataType":[{},{}]}', '{"SPAudioDataType":[],"SPUSBDataType":[]}', '{"Other":[]}', '"a"', '7']) {
      expect(refusal(shape), shape).toBe(MacosSystemAudioRefusal.NOT_THE_LIST);
    }
    for (const item of ['7', '"a"', '[]', '{}', '{"_name":7}', '{"_name":null}', '{"_name":["a"]}']) expect(refusal(`{"SPAudioDataType":[{"_items":[${item}]}]}`), item).toBe(MacosSystemAudioRefusal.ITEM_FORM);
    const many = (count: number): string => systemOf(Array.from({ length: count }, (_, index) => ({ name: `DEMS ${index}`, inputs: 1 })));
    expect(refusal(many(32))).toBe('READ');
    expect(refusal(many(33))).toBe(MacosSystemAudioRefusal.TOO_MANY_ITEMS);
    for (const text of [
      '{"SPAudioDataType":[],"SPAudioDataType":[]}',
      '{"SPAudioDataType":[{"_items":[{"_name":"a","_name":"b"}]}]}',
      '{"SPAudioDataType":[]} x',
      '{"SPAudioDataType":[],}',
      "{'SPAudioDataType':[]}",
      '{"SPAudioDataType":[{"_items":[{"_name":"a\nb"}]}]}',
      '{"SPAudioDataType":[{"_items":[{"_name":"a\\x"}]}]}',
      '{"SPAudioDataType":[01]}',
      '',
      ' ',
    ]) {
      expect(refusal(text), text).toBe(MacosSystemAudioRefusal.NOT_JSON);
    }
    // The text ends without a line end (measured): a cut text is no JSON. No proper beginning of the fixture is read.
    const whole = fx('system-one-interface');
    expect(whole.endsWith('}')).toBe(true);
    const read: number[] = [];
    for (let length = 0; length < whole.length; length += 1) if (parseMacosSystemAudio(whole.slice(0, length)).ok) read.push(length);
    expect(read).toEqual([]);
    expect(refusal(`${'['.repeat(MACOS_SYSTEM_AUDIO_LIMITS.depth + 1)}${']'.repeat(MACOS_SYSTEM_AUDIO_LIMITS.depth + 1)}`)).toBe(MacosSystemAudioRefusal.DEPTH);
    expect(refusal(`[${'0,'.repeat(MACOS_SYSTEM_AUDIO_LIMITS.nodes)}0]`)).toBe(MacosSystemAudioRefusal.NODES);
    const padded = (length: number): string => `${whole}${' '.repeat(length - whole.length)}`;
    expect(refusal(padded(MACOS_SYSTEM_AUDIO_LIMITS.textCharacters))).toBe('READ');
    expect(refusal(padded(MACOS_SYSTEM_AUDIO_LIMITS.textCharacters + 1))).toBe(MacosSystemAudioRefusal.TOO_LONG);
    expect(refusal(null)).toBe(MacosSystemAudioRefusal.NOT_TEXT);
  });

  it('the JSON reader tells an integer from any other number, keeps a key of the text out of an object, and reads the escapes of a name', () => {
    const kind = (text: string): unknown => {
      const parsed = parseStrictJson(text);
      return parsed.ok ? parsed.value : parsed.reason;
    };
    expect(kind('6')).toEqual({ kind: 'integer', value: 6 });
    expect(kind('-12')).toEqual({ kind: 'integer', value: -12 });
    for (const float of ['6.0', '6e0', '6E+1', '0.5', '9007199254740993']) expect(kind(float), float).toEqual({ kind: 'number' });
    for (const bad of ['06', '+6', '.5', '6.', 'NaN', 'Infinity', '0x10']) expect(kind(bad), bad).toBe('NOT_JSON');
    expect(kind('"a\\n\\"\\u003cb\\u003E\\\\"')).toEqual({ kind: 'string', value: 'a\n"<b>\\' });
    const proto = parseStrictJson('{"__proto__":{"polluted":true},"constructor":1}');
    expect(proto.ok && proto.value.kind === 'object' && [...proto.value.members.keys()]).toEqual(['__proto__', 'constructor']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// ── 4. The capture program's list ─────────────────────────────────────────────────────────────

describe("the capture program's list: the index is the fact, so the list is read whole or not at all", () => {
  const refusal = (text: unknown): string => {
    const list = parseMacosHelperList(text);
    return list.ok ? 'READ' : list.reason;
  };

  it('the fixture: the video section stands first with indexes of its own and gives no audio entry; the audio entries with their indexes', () => {
    expect(parseMacosHelperList(fx('helper-one-interface'))).toEqual({ ok: true, entries: [{ index: 0, name: 'DEMS Built-in Input' }, { index: 1, name: 'DEMS Hexa 6' }] });
    expect(parseMacosHelperList(fx('helper-aggregate'))).toMatchObject({ ok: true, entries: { length: 6 } });
    // A host with no audio device at all: the section line, and no entry.
    expect(parseMacosHelperList(helperOf([]))).toEqual({ ok: true, entries: [] });
    // Line ends of the other kind are the same lines.
    expect(parseMacosHelperList(fx('helper-one-interface').replace(/\n/g, '\r\n'))).toMatchObject({ ok: true, entries: [{ index: 0 }, { index: 1, name: 'DEMS Hexa 6' }] });
  });

  it('refuses the WHOLE list, each with its word: no section, the section twice, an index twice, out of order, a gap, not canonical, another tag, an entry after other text, an over-long line, a 33rd entry', () => {
    expect(refusal(`${TAG} AVFoundation video devices:\n${TAG} [0] DEMS Synthetic Camera\n${HELPER_END}`)).toBe(MacosHelperListRefusal.NO_AUDIO_SECTION);
    expect(refusal('')).toBe(MacosHelperListRefusal.NO_AUDIO_SECTION);
    // The section line must be the whole line with the tag: a camera NAMED like it is no section.
    expect(refusal(`${TAG} AVFoundation video devices:\n${TAG} [0] AVFoundation audio devices:\n${TAG} [1] DEMS Hexa 6\n`)).toBe(MacosHelperListRefusal.NO_AUDIO_SECTION);
    // A camera whose name carries a line break and the section line itself: the real one is then the second.
    expect(refusal(`${TAG} AVFoundation video devices:\n${TAG} [0] DEMS\n${TAG} AVFoundation audio devices:\n${TAG} [0] DEMS Forged\n${TAG} AVFoundation audio devices:\n${TAG} [0] DEMS Hexa 6\n`)).toBe(MacosHelperListRefusal.SECTION_REPEATED);
    const entry = (index: string, name = 'DEMS Hexa 6'): string => `${TAG} [${index}] ${name}`;
    expect(refusal(helperLines([entry('0'), entry('0')]))).toBe(MacosHelperListRefusal.INDEX_ORDER);
    expect(refusal(helperLines([entry('1'), entry('0')]))).toBe(MacosHelperListRefusal.INDEX_ORDER);
    expect(refusal(helperLines([entry('0'), entry('2')]))).toBe(MacosHelperListRefusal.INDEX_ORDER);
    expect(refusal(helperLines([entry('1')]))).toBe(MacosHelperListRefusal.INDEX_ORDER);
    for (const index of ['00', '01', '+0', '0x0', ' 0', '', '100', '-1']) expect(refusal(helperLines([entry(index)])), index).toBe(MacosHelperListRefusal.ENTRY_FORM);
    expect(refusal(helperLines([`${TAG} [0] `]))).toBe(MacosHelperListRefusal.ENTRY_FORM);
    expect(refusal(helperLines([`${TAG} [0]`]))).toBe(MacosHelperListRefusal.ENTRY_FORM);
    expect(refusal(helperLines([entry('0'), `${TAG} AVFoundation video devices:`]))).toBe(MacosHelperListRefusal.ENTRY_FORM);
    expect(refusal(helperLines([entry('0'), '[AVFoundation indev @ 0x7f8a5c00dead] [1] DEMS Solo 1']))).toBe(MacosHelperListRefusal.TAG_DIFFERS);
    expect(refusal(helperLines([entry('0'), '[AVFoundation indev @ 0xZZ] [1] DEMS Solo 1']))).toBe(MacosHelperListRefusal.TAG_DIFFERS);
    expect(refusal(helperLines([entry('0'), 'a line of something else', entry('1')]))).toBe(MacosHelperListRefusal.ENTRY_AFTER_OTHER_TEXT);
    expect(refusal(helperLines([entry('0', 'a'.repeat(CARD_LISTING_LIMITS.lineCharacters))]))).toBe(MacosHelperListRefusal.ENTRY_FORM);
    expect(refusal(helperLines([entry('0'), 'x'.repeat(CARD_LISTING_LIMITS.lineCharacters + 1)]))).toBe(MacosHelperListRefusal.ENTRY_FORM);
    const names = (count: number): string[] => Array.from({ length: count }, (_, index) => `DEMS ${index}`);
    expect(parseMacosHelperList(helperOf(names(32)))).toMatchObject({ ok: true, entries: { length: 32 } });
    expect(refusal(helperOf(names(33)))).toBe(MacosHelperListRefusal.TOO_MANY_ENTRIES);
    // The fixture of the name with a line break and a made-up entry: the made-up line cannot know the tag of the run.
    expect(refusal(fx('helper-hostile-line-break'))).toBe(MacosHelperListRefusal.TAG_DIFFERS);
    // The same name with the tag GUESSED: the made-up entry takes an index, and the real one is then a repeat.
    expect(refusal(fx('helper-hostile-line-break').replace('0x7f8a5c00dead', '0x7f8a5c004a00'))).toBe(MacosHelperListRefusal.ENTRY_AFTER_OTHER_TEXT);
    expect(refusal(helperLines([entry('0', 'DEMS Hexa 6"'), entry('1'), entry('1')]))).toBe(MacosHelperListRefusal.INDEX_ORDER);
    const long = `${helperOf(['DEMS Hexa 6'])}${'\n'.repeat(CARD_LISTING_LIMITS.textCharacters)}`;
    expect(refusal(long)).toBe(MacosHelperListRefusal.TOO_LONG);
    expect(refusal(`${helperOf(['DEMS Hexa 6'])}${'\n'.repeat(CARD_LISTING_LIMITS.lines)}`)).toBe(MacosHelperListRefusal.TOO_LONG);
    expect(refusal(7)).toBe(MacosHelperListRefusal.NOT_TEXT);
  });

  it('a CUT text never states a cut name or a wrong index: every beginning of the fixture is refused or gives the first entries exactly', () => {
    const whole = fx('helper-one-interface');
    const full = ['DEMS Built-in Input', 'DEMS Hexa 6'];
    const seen = new Set<string>();
    for (let length = 0; length <= whole.length; length += 1) {
      const list = parseMacosHelperList(whole.slice(0, length));
      if (!list.ok) {
        seen.add(list.reason);
        continue;
      }
      expect(list.entries.map((entry) => entry.name), String(length)).toEqual(full.slice(0, list.entries.length));
      expect(list.entries.map((entry) => entry.index)).toEqual([0, 1].slice(0, list.entries.length));
      seen.add(`READ ${list.entries.length}`);
    }
    // A cut before the audio section is refused; after it, a list of fewer entries - which the tie then refuses as LISTS_DISAGREE (below).
    expect([...seen].sort()).toEqual([MacosHelperListRefusal.NO_AUDIO_SECTION, 'READ 0', 'READ 1', 'READ 2']);
  });
});

// ── 5. The tie and the enumerator, on every fixture ───────────────────────────────────────────

const HEXA_CARD = (cardIndex: number, usbPort = '01120000'): CaptureCard => ({
  cardIndex,
  deviceIndex: 0,
  cardId: `usb_${usbPort}`,
  usb: true,
  usbId: '1a2b:0006',
  usbPort,
  usbSerial: null,
  product: 'DEMS Hexa 6',
  channelCount: 6,
  factsSource: CardFactsSource.SYSTEM_PROFILE,
  formats: [],
  nativeFormat: 'S32_LE',
  sampleBits: [],
  ratesHz: [48000],
  rateRangeHz: null,
});

/** Every fixture set that is readable as a whole, by name, with the tree it belongs to. */
const READABLE_SETS: readonly (readonly [string, string])[] = [
  ['one-interface', 'one-interface'],
  ['two-same-model', 'two-same-model'],
  ['two-same-named', 'two-same-named'],
  ['virtual', 'one-interface'],
  ['aggregate', 'one-interface'],
  ['hostile-strings', 'hostile-strings'],
];
const readSet = (name: string, tree: string) => {
  const [treeText, system, helper] = set(name, tree);
  return tied(treeText.replace('@@FOUR_KIB@@', FOUR_KIB), system, helper);
};

describe('the tie: one USB audio input = one entry of each list, any doubt refused with a named reason', () => {
  it('one USB interface with six inputs beside a built-in input: ONE card, in the shape of the Linux listing; the built-in input is passed over and is no card', () => {
    const result = readSet('one-interface', 'one-interface');
    expect(result.cards).toEqual([HEXA_CARD(1)]);
    expect(result.listing).toEqual({ cards: [HEXA_CARD(1)], truncated: false, skipped: 0 });
    expect([result.undecided, result.refusedDevices, result.passedOver, result.captureEntries]).toEqual([[], 0, 1, 2]);
    expect(Object.isFrozen(result.cards[0])).toBe(true);
  });

  it('THE PORT PATH: the location as eight lower-case hex digits passes the rule of the card listing, the contract pattern and the CHECK of the column as the migration wrote it; the card id passes its own', () => {
    const [card] = readSet('one-interface', 'one-interface').cards;
    const migration = readFileSync(resolve(HERE, '..', '..', '..', '..', 'db', 'migrations', '0017_network_commissioning.sql'), 'utf8');
    const check = /"usb_port" IS NULL OR "capture_audio_inputs"\."usb_port" ~ '([^']+)'\)/.exec(migration);
    expect(check?.[1]).toBe('^[A-Za-z0-9:._-]{1,64}$');
    const column = new RegExp(check?.[1] ?? '$^');
    for (const port of [card?.usbPort ?? '', '00000001', 'ffffffff']) {
      expect(port).toMatch(/^[0-9a-f]{8}$/);
      expect(port).toMatch(column);
      expect(port).toMatch(CAPTURE_AUDIO_USB_PORT_PATTERN);
      expect(`usb_${port}`).toMatch(CAPTURE_AUDIO_CARD_ID_PATTERN);
    }
    expect(card?.usbId).toMatch(CAPTURE_AUDIO_USB_ID_PATTERN);
  });

  it('SM-05: two same-model interfaces on two ports - BOTH undecided (NAME_SHARED), the one with a serial too: the serial does not rescue a tie made by name', () => {
    const result = readSet('two-same-model', 'two-same-model');
    expect(result.cards).toEqual([]);
    expect(result.undecided).toEqual([
      { reason: 'NAME_SHARED', usbId: '1a2b:0002', usbPort: '01120000', usbSerial: 'SN-SYN-DUO-0001' },
      { reason: 'NAME_SHARED', usbId: '1a2b:0002', usbPort: '02100000', usbSerial: null },
    ]);
    // Not "no card": the count of skipped entries says two devices are there.
    expect(result.listing).toEqual({ cards: [], truncated: false, skipped: 2 });
  });

  it('two devices of DIFFERENT models under one name: both undecided; a third device with a name of its own is a card at its own index', () => {
    const result = readSet('two-same-named', 'two-same-named');
    expect(reasons(result)).toEqual(['NAME_SHARED', 'NAME_SHARED']);
    expect(result.undecided.map((device) => device.usbId)).toEqual(['1a2b:0010', '1a2c:0325']);
    expect(result.cards.map((card) => [card.cardIndex, card.cardId, card.usbId, card.product, card.channelCount])).toEqual([[1, 'usb_02100000', '1a2b:0001', 'DEMS Solo 1', 1]]);
    expect(result.listing.skipped).toBe(2);
  });

  it('a virtual device, an aggregate device, a wireless and a network device, a device with no transport word: never offered - the USB interface is the one card, at the index of ITS entry', () => {
    const virtual = readSet('virtual', 'one-interface');
    expect([virtual.cards, virtual.undecided, virtual.passedOver]).toEqual([[HEXA_CARD(2)], [], 2]);
    const aggregate = readSet('aggregate', 'one-interface');
    expect([aggregate.cards, aggregate.undecided, aggregate.passedOver, aggregate.listing.skipped]).toEqual([[HEXA_CARD(3)], [], 5, 0]);
  });

  it('SM-22: a listing with only the built-in input lists 0 cards and skips nothing; a virtual device that CLAIMS the USB word and has no device of the tree is no card (NO_USB_DEVICE)', () => {
    const builtIn = tied('', systemOf([BUILT_IN]), helperOf([BUILT_IN.name]));
    expect([builtIn.cards, builtIn.undecided, builtIn.passedOver, builtIn.listing.skipped]).toEqual([[], [], 1, 0]);
    const claimed = tied(fx('tree-one-interface'), systemOf([{ name: HEXA, inputs: 6 }, { name: 'DEMS Claims USB', inputs: 2 }, BUILT_IN]), helperOf([HEXA, 'DEMS Claims USB', BUILT_IN.name]));
    expect(claimed.cards).toEqual([HEXA_CARD(0)]);
    expect(claimed.undecided).toEqual([{ reason: 'NO_USB_DEVICE', usbId: null, usbPort: null, usbSerial: null }]);
    expect(claimed.listing.skipped).toBe(1);
  });

  it('SM-03 (5): a built-in, a virtual, an aggregate or a wireless input UNDER THE NAME of the USB unit makes the unit undecided - it is never opened in its place', () => {
    for (const transport of ['coreaudio_device_type_builtin', 'coreaudio_device_type_virtual', 'coreaudio_device_type_aggregate', 'coreaudio_device_type_bluetooth', null]) {
      const twin = tied(treeOf([{ location: PORT_A }]), systemOf([{ name: HEXA, inputs: 6 }, { name: HEXA, inputs: 6, transport }]), helperOf([HEXA, HEXA]));
      expect([twin.cards, reasons(twin)], String(transport)).toEqual([[], ['NAME_SHARED']]);
      // The unit's own audio device is absent and another transport presents its name: one item, and it is not USB.
      const alone = tied(treeOf([{ location: PORT_A }]), systemOf([{ name: HEXA, inputs: 6, transport }]), helperOf([HEXA]));
      expect([alone.cards, reasons(alone)], String(transport)).toEqual([[], ['TRANSPORT_NOT_USB']]);
    }
  });

  it('a device in ONE LIST ONLY: NO_SYSTEM_INPUT (also the confined, empty system list and an output-only device), NO_CAPTURE_ENTRY - never "no card"', () => {
    // SM-13: the system list is empty while the tree shows an audio device and the capture list its entry.
    const confined = tied(fx('tree-one-interface'), '{"SPAudioDataType":[]}', fx('helper-one-interface'));
    expect([confined.cards, confined.undecided, confined.listing.skipped]).toEqual([[], [{ reason: 'NO_SYSTEM_INPUT', usbId: '1a2b:0006', usbPort: '01120000', usbSerial: null }], 1]);
    // A USB output-only device: an item of its name with no input.
    expect(reasons(one({}, { inputs: undefined }, [BUILT_IN.name]))).toEqual(['NO_SYSTEM_INPUT']);
    // In the tree and in neither other list.
    expect(reasons(one({}, null))).toEqual(['NO_SYSTEM_INPUT']);
    // In the tree and the system list, and not in the capture program's list.
    expect(reasons(one({}, {}, [BUILT_IN.name]))).toEqual(['NO_CAPTURE_ENTRY']);
    // SM-11 into the tie: a count written as a float is no input the tie may use.
    expect(reasons(one({}, { inputs: '6.0' }))).toEqual(['NO_SYSTEM_INPUT']);
    expect(reasons(one({}, { rate: '"48000"' }))).toEqual(['NO_SYSTEM_INPUT']);
  });

  it('SM-03 (1): the input items and the audio entries must be the SAME MULTISET of names, else EVERY device is undecided (LISTS_DISAGREE) - in either direction, and for a cut capture list', () => {
    const tree = treeOf([{ location: PORT_A }, { location: PORT_C, name: 'DEMS Solo 1', product: 1 }]);
    const system = [{ name: HEXA, inputs: 6 }, { name: 'DEMS Solo 1', inputs: 1 }, BUILT_IN];
    expect(tied(tree, systemOf(system), helperOf([HEXA, 'DEMS Solo 1', BUILT_IN.name])).cards.map((card) => card.cardIndex)).toEqual([0, 1]);
    // An entry of the capture list the system list does not explain: it is exactly what shifts an index.
    const extraEntry = tied(tree, systemOf(system), helperOf(['DEMS Hidden', HEXA, 'DEMS Solo 1', BUILT_IN.name]));
    expect([extraEntry.cards, reasons(extraEntry)]).toEqual([[], ['LISTS_DISAGREE', 'LISTS_DISAGREE']]);
    // The reverse: an input of the system list with no entry.
    const extraItem = tied(tree, systemOf([...system, { name: 'DEMS Hidden', inputs: 2, transport: 'coreaudio_device_type_virtual' }]), helperOf([HEXA, 'DEMS Solo 1', BUILT_IN.name]));
    expect([extraItem.cards, reasons(extraItem)]).toEqual([[], ['LISTS_DISAGREE', 'LISTS_DISAGREE']]);
    // The same names, one of them twice in one list only.
    expect(reasons(tied(tree, systemOf(system), helperOf([HEXA, 'DEMS Solo 1', BUILT_IN.name, BUILT_IN.name])))).toEqual(['LISTS_DISAGREE', 'LISTS_DISAGREE']);
    // Names are compared as exact text: never folded, trimmed or cut.
    expect(reasons(tied(tree, systemOf(system), helperOf([HEXA, 'DEMS SOLO 1', BUILT_IN.name])))).toEqual(['LISTS_DISAGREE', 'NO_CAPTURE_ENTRY']);
    // A capture list cut after its first entry (a readable beginning, see above): the other devices are not listed from it.
    const cut = fx('helper-one-interface').slice(0, fx('helper-one-interface').indexOf('[1] DEMS Hexa'));
    expect(reasons(tied(fx('tree-one-interface'), fx('system-one-interface'), cut))).toEqual(['NO_CAPTURE_ENTRY']);
    // An unreadable input of ANOTHER device takes every device with it: its entry is in the capture list and explained by nothing.
    const other = tied(tree, systemOf([{ name: HEXA, inputs: 6 }, { name: 'DEMS Solo 1', inputs: '1.0' }, BUILT_IN]), helperOf([HEXA, 'DEMS Solo 1', BUILT_IN.name]));
    expect([other.cards, reasons(other)]).toEqual([[], ['LISTS_DISAGREE', 'NO_SYSTEM_INPUT']]);
  });

  it('SM-03 (2), SM-12 (4): a name that is not tieable - a tag mark, a quote and a line break, a mark of direction, a letter beyond ASCII, 65 and 300 characters, a locator, outer spaces, no name - is refused and NOT compared; plain words are names', () => {
    const untieable = ['<b>DEMS</b>', 'DEMS‮axeH', 'DEMS Héxa', 'D'.repeat(65), 'D'.repeat(300), 'usb://dems-hexa', 'DEMS @ desk', 'operator@dems', ' DEMS Hexa 6', 'DEMS Hexa 6 ', 'DEMS\tHexa', '\u0007'];
    for (const name of untieable) {
      expect(isTieableName(name), name).toBe(false);
      // The other two lists carry the very same text: the tie still does not compare it.
      const result = tied(treeOf([{ location: PORT_A, name }]), systemOf([{ name, inputs: 2 }]), helperOf([name]));
      expect([result.cards, result.undecided], name).toEqual([[], [{ reason: 'NAME_NOT_TIEABLE', usbId: '1a2b:0006', usbPort: '01120000', usbSerial: null }]]);
    }
    expect(isTieableName(null)).toBe(false);
    expect(reasons(tied(treeOf([{ location: PORT_A, name: null }]), systemOf([BUILT_IN]), helperOf([BUILT_IN.name])))).toEqual(['NAME_NOT_TIEABLE']);
    expect(reasons(tied(treeOf([{ location: PORT_A, name: '' }]), systemOf([BUILT_IN]), helperOf([BUILT_IN.name])))).toEqual(['NAME_NOT_TIEABLE']);
    // The helper is started with an INDEX, so a name the device layer would read as a keyword or a number is only a name here.
    for (const name of ['none', 'default', '0 Leading Digit', 'DEMS "Quoted" 6', 'D'.repeat(64)]) {
      const result = tied(treeOf([{ location: PORT_A, name }]), systemOf([{ name, inputs: 2 }, BUILT_IN]), helperOf([BUILT_IN.name, name]));
      expect(result.cards.map((card) => [card.cardIndex, card.product, card.channelCount]), name).toEqual([[1, name, 2]]);
    }
  });

  it('hostile product strings (markup, a forged plist key, 4 KiB of text): each such device is undecided by its REAL place, the clean device beside them is listed, and no text of them is in the answer', () => {
    const result = readSet('hostile-strings', 'hostile-strings');
    expect(result.cards).toEqual([HEXA_CARD(2, '02100000')]);
    expect(result.undecided).toEqual([
      { reason: 'NAME_NOT_TIEABLE', usbId: '1a2b:00a1', usbPort: '01110000', usbSerial: null },
      { reason: 'NAME_NOT_TIEABLE', usbId: '1a2b:00a2', usbPort: '01120000', usbSerial: null },
      { reason: 'NAME_NOT_TIEABLE', usbId: '1a2b:00a4', usbPort: '01140000', usbSerial: null },
    ]);
    const answer = JSON.stringify(result);
    for (const text of ['<', '>', 'script', 'locationID', 'DEMS-LONG', '34603008', '&']) expect(answer, text).not.toContain(text);
  });

  it('a product string with a quote, a LINE BREAK, a forged header and a forged entry: the capture list is not read at all, and the listing is undecided as a whole - no index is taken from it', () => {
    const [tree, system, helper] = set('hostile-line-break');
    // The tree and the system list keep the string as ONE string: the forged location is text, the device has its real place.
    expect(parseMacosUsbTree(tree)).toMatchObject({ ok: true, refused: 0, audioDevices: [{ usbPort: '01130000' }, { usbPort: '02100000' }] });
    expect(parseMacosSystemAudio(system)).toMatchObject({ ok: true, items: [{ inputChannels: 2 }, { name: 'DEMS Hexa 6', inputChannels: 6 }] });
    const result = readMacosListing(tree, system, helper);
    expect(result).toEqual({ ok: false, failure: MacosListingFailure.CAPTURE_LIST_UNREADABLE, detail: MacosHelperListRefusal.TAG_DIFFERS });
    // Were the device the LAST entry (nothing after its extra lines), the list is readable - and the two lists then disagree.
    const last = tied(tree, system, `${TAG} AVFoundation audio devices:\n${TAG} [0] DEMS Hexa 6\n${TAG} [1] DEMS Hexa 6"\n+-o Forged\n`);
    expect([last.cards, reasons(last)]).toEqual([[], ['NAME_NOT_TIEABLE', 'LISTS_DISAGREE']]);
  });

  it('SM-01 (b): on EVERY fixture every card is a USB card with a USB id, a port and a card id written from the integers - never the fixed id, never a card that is not USB; every string has passed the one function', () => {
    let cards = 0;
    for (const [name, tree] of READABLE_SETS) {
      const result = readSet(name, tree);
      for (const card of result.cards) {
        cards += 1;
        expect([card.usb, card.deviceIndex, card.factsSource, card.cardId], name).toEqual([true, 0, 'SYSTEM_PROFILE', `usb_${card.usbPort}`]);
        expect(card.usbId).toMatch(CAPTURE_AUDIO_USB_ID_PATTERN);
        expect(card.usbId).not.toBe(CARD_USB_ID_REPLACEMENT);
        expect(card.usbPort).toMatch(/^[0-9a-f]{8}$/);
        expect(cardListingText(CardStringKind.NAME, card.product)).toBe(card.product);
        expect(cardListingText(CardStringKind.FACTS_SOURCE, card.factsSource)).toBe('SYSTEM_PROFILE');
        if (card.usbSerial !== null) expect(card.usbSerial).toMatch(CAPTURE_AUDIO_USB_SERIAL_PATTERN);
        expect(result.listing.cards.filter((other) => other.cardIndex === card.cardIndex)).toHaveLength(1);
      }
      expect(result.listing.skipped, name).toBe(result.undecided.length + result.refusedDevices);
      expect(result.listing.truncated).toBe(false);
    }
    expect(cards).toBe(5);
  });

  it('a device the tree reader refused is counted in skipped; the rate of the system list is the one rate of the card (96,000 is stated, not hidden)', () => {
    const refused = tied(treeOf([{ location: PORT_A, raw: { locationID: '<integer>1</integer>' } }]), systemOf([{ name: HEXA, inputs: 6 }]), helperOf([HEXA]));
    expect([refused.cards, refused.refusedDevices, reasons(refused), refused.listing.skipped]).toEqual([[], 1, ['NO_USB_DEVICE'], 2]);
    expect(one({}, { rate: 96000 }).cards[0]?.ratesHz).toEqual([96000]);
  });

  it('the mark of the ordered capture list: equal for the same list, another for another order or another entry; the tie is a function of its three lists', () => {
    const tree = treeOf([{ location: PORT_A }]);
    const system = systemOf([{ name: HEXA, inputs: 6 }, BUILT_IN]);
    const first = tied(tree, system, helperOf([HEXA, BUILT_IN.name]));
    const again = tied(tree, system, helperOf([HEXA, BUILT_IN.name]));
    const swapped = tied(tree, system, helperOf([BUILT_IN.name, HEXA]));
    expect(again).toEqual(first);
    expect(swapped.captureOrderMark).not.toBe(first.captureOrderMark);
    expect([first.cards[0]?.cardIndex, swapped.cards[0]?.cardIndex]).toEqual([0, 1]);
    expect(tieMacosLists([], [], []).captureOrderMark).not.toBe(first.captureOrderMark);
    expect(Number.isInteger(first.captureOrderMark) && first.captureOrderMark >= 0 && first.captureOrderMark <= 0xffff_ffff).toBe(true);
  });
});

describe('the enumerator: the shape the Linux consumers call, and UNDECIDED is never an empty listing', () => {
  it('reads all three lists at every call, keeps nothing, and answers the listing of the tie', async () => {
    const calls: string[] = [];
    const [tree, system, helper] = set('one-interface');
    const enumerator = createMacosCardEnumerator({
      usbTree: async () => (calls.push('tree'), tree),
      systemAudio: async () => (calls.push('system'), system),
      captureDevices: async () => (calls.push('capture'), helper),
    });
    expect(await enumerator.list()).toEqual({ cards: [HEXA_CARD(1)], truncated: false, skipped: 0 });
    expect(await enumerator.list()).toEqual({ cards: [HEXA_CARD(1)], truncated: false, skipped: 0 });
    expect(calls).toEqual(['tree', 'system', 'capture', 'tree', 'system', 'capture']);
  });

  it('each list that fails its reader - truncated, one character over its bound, another form - makes the WHOLE listing undecided: `list` raises the named error, with closed words and no text of a list', async () => {
    const [tree, system, helper] = set('one-interface');
    const over = (text: string, pad: string): string => `${text}${pad.repeat(CARD_LISTING_LIMITS.textCharacters + 1 - text.length)}`;
    const cases: readonly (readonly [string, string, string, string, string])[] = [
      [tree.slice(0, 1500), system, helper, MacosListingFailure.USB_TREE_UNREADABLE, PlistRefusal.FOOT],
      // MOVED BY ROW N5b (decision C131 (2)): the tree's own bound is the row's 512 KiB, no longer the listing's 65,536 characters.
      [`${tree}${'\n'.repeat(MACOS_PLIST_LIMITS.textCharacters + 1 - tree.length)}`, system, helper, MacosListingFailure.USB_TREE_UNREADABLE, PlistRefusal.TOO_LONG],
      [fx('tree-forged-unescaped'), system, helper, MacosListingFailure.USB_TREE_UNREADABLE, PlistRefusal.KEY],
      [fx('tree-entity-declaration'), system, helper, MacosListingFailure.USB_TREE_UNREADABLE, PlistRefusal.HEAD],
      [plist('<dict/>'), system, helper, MacosListingFailure.USB_TREE_UNREADABLE, MacosUsbTreeRefusal.NOT_A_DEVICE_LIST],
      [tree, system.slice(0, 700), helper, MacosListingFailure.SYSTEM_LIST_UNREADABLE, MacosSystemAudioRefusal.NOT_JSON],
      [tree, over(system, ' '), helper, MacosListingFailure.SYSTEM_LIST_UNREADABLE, MacosSystemAudioRefusal.TOO_LONG],
      [tree, '', helper, MacosListingFailure.SYSTEM_LIST_UNREADABLE, MacosSystemAudioRefusal.NOT_JSON],
      [tree, system, helper.slice(0, 200), MacosListingFailure.CAPTURE_LIST_UNREADABLE, MacosHelperListRefusal.NO_AUDIO_SECTION],
      [tree, system, over(helper, '\n'), MacosListingFailure.CAPTURE_LIST_UNREADABLE, MacosHelperListRefusal.TOO_LONG],
      [tree, system, '', MacosListingFailure.CAPTURE_LIST_UNREADABLE, MacosHelperListRefusal.NO_AUDIO_SECTION],
      [tree, system, fx('helper-hostile-line-break'), MacosListingFailure.CAPTURE_LIST_UNREADABLE, MacosHelperListRefusal.TAG_DIFFERS],
    ];
    for (const [treeText, systemText, helperText, failure, detail] of cases) {
      const enumerator = createMacosCardEnumerator(sourceOf(treeText, systemText, helperText));
      expect(await enumerator.listTied(), `${failure} ${detail}`).toEqual({ ok: false, failure, detail });
      const raised = await enumerator.list().then(
        () => null,
        (error: unknown) => error,
      );
      expect(raised).toBeInstanceOf(MacosCardListingError);
      const error = raised as MacosCardListingError;
      expect([error.code, error.failure, error.detail, error.message]).toEqual([MACOS_CARD_LISTING_UNDECIDED, failure, detail, 'a list of the card listing could not be read']);
      expect(`${error.stack ?? ''}${JSON.stringify(error)}`).not.toMatch(/DEMS Hexa|Forged|SN-SYN/);
    }
  });

  it('a failure of the source is passed on unchanged: a row that failed is never an empty text', async () => {
    const failure = new Error('the row ended with an error');
    const [tree, system, helper] = set('one-interface');
    for (const broken of ['usbTree', 'systemAudio', 'captureDevices'] as const) {
      const enumerator = createMacosCardEnumerator({ ...sourceOf(tree, system, helper), [broken]: async () => Promise.reject(failure) });
      await expect(enumerator.list()).rejects.toBe(failure);
      await expect(enumerator.listTied()).rejects.toBe(failure);
    }
  });
});

// ── 6. The identity, fed into the EXISTING match (unedited) ───────────────────────────────────

describe('identifyRegisteredCard on a macOS listing: by the serial, else by the port path - the rule of decision C56, by the same function', () => {
  interface Unit {
    readonly location: number;
    readonly serial?: string;
    readonly vendor?: number;
    readonly product?: number;
    readonly name?: string;
  }
  /** A host with these USB audio units, each under a name of its own unless one is given. */
  const listingOf = async (units: readonly Unit[]) => {
    const named = units.map((unit, index) => ({ ...unit, name: unit.name ?? (units.length === 1 ? HEXA : `DEMS Unit ${index}`) }));
    const enumerator = createMacosCardEnumerator(
      sourceOf(treeOf(named), systemOf([BUILT_IN, ...named.map((unit) => ({ name: unit.name, inputs: 6 }))]), helperOf([BUILT_IN.name, ...named.map((unit) => unit.name)])),
    );
    return enumerator.list();
  };
  /** The row the registration would store for the one card of a listing. */
  const registered = async (unit: Unit, patch: Partial<RegisteredAudioInput> = {}): Promise<RegisteredAudioInput> => {
    const [card] = (await listingOf([unit])).cards;
    if (card === undefined) throw new Error('the unit was expected to be listed');
    return { deviceId: 'MIC-01', usbId: card.usbId, cardId: card.cardId, cardDevice: card.deviceIndex, inputNumber: 3, nativeChannels: card.channelCount, usbSerial: card.usbSerial, usbPort: card.usbPort, ...patch };
  };
  const answer = async (units: readonly Unit[], stored: RegisteredAudioInput): Promise<unknown> => {
    const found = identifyRegisteredCard(await listingOf(units), stored);
    return found.ok ? [found.card.cardId, found.card.cardIndex, found.renamed] : [found.refusal, found.detail ?? null];
  };
  const SERIAL = 'SN-SYN-MINE-0001';

  it('the stored row of a macOS card is a row of the shape the adapter accepts', async () => {
    const stored = await registered({ location: PORT_A });
    expect(stored).toMatchObject({ usbId: '1a2b:0006', cardId: 'usb_01120000', cardDevice: 0, nativeChannels: 6, usbSerial: null, usbPort: '01120000' });
    expect(isRegisteredAudioInput(stored)).toBe(true);
  });

  it('the same unit in the same socket is found - at whatever index the capture list gives it', async () => {
    const stored = await registered({ location: PORT_A });
    expect(await answer([{ location: PORT_A }], stored)).toEqual(['usb_01120000', 1, false]);
    // Another device before it in the capture list: another index, the same card.
    expect(await answer([{ location: PORT_C, product: 1, name: 'DEMS Solo 1' }, { location: PORT_A, name: HEXA }], stored)).toEqual(['usb_01120000', 2, false]);
  });

  it('a registered card WITH a serial is found on another port (renamed: its card id follows the socket)', async () => {
    const stored = await registered({ location: PORT_A, serial: SERIAL });
    expect(stored.usbSerial).toBe(SERIAL);
    expect(await answer([{ location: PORT_A, serial: SERIAL }], stored)).toEqual(['usb_01120000', 1, false]);
    expect(await answer([{ location: PORT_C, serial: SERIAL }], stored)).toEqual(['usb_02100000', 1, true]);
  });

  // R-FLEX row 107 (T-3; D10 ruling 1, no port lock): the stored port is no lock; the card id follows the socket, so a move is `renamed`.
  it('a registered card WITHOUT a serial is found on ANY socket: moved to another socket it is the same card, renamed (its card id follows the socket); two serial-less units: AMBIGUOUS / MODEL_SHARED', async () => {
    const stored = await registered({ location: PORT_A });
    expect(await answer([{ location: PORT_A }], stored)).toEqual(['usb_01120000', 1, false]);
    expect(await answer([{ location: PORT_C }], stored)).toEqual(['usb_02100000', 1, true]);
    expect(await answer([{ location: PORT_A }, { location: PORT_C, name: 'DEMS Hexa 2' }], stored)).toEqual([UsbAudioRefusal.CARD_AMBIGUOUS, CardMismatch.MODEL_SHARED]);
  });

  it('a SAME-MODEL device elsewhere is NOT a match, the registered one unplugged: by another serial, or by a serial where none was registered - never opened in its place', async () => {
    const withSerial = await registered({ location: PORT_A, serial: SERIAL });
    expect(await answer([{ location: PORT_A, serial: 'SN-SYN-OTHER-0002' }], withSerial)).toEqual([UsbAudioRefusal.CARD_CHANGED, CardMismatch.SERIAL_DIFFERS]);
    expect(await answer([{ location: PORT_C, serial: 'SN-SYN-OTHER-0002' }], withSerial)).toEqual([UsbAudioRefusal.CARD_CHANGED, CardMismatch.SERIAL_DIFFERS]);
    // The same socket, a unit that states no serial where one was registered.
    expect(await answer([{ location: PORT_A }], withSerial)).toEqual([UsbAudioRefusal.CARD_CHANGED, CardMismatch.SERIAL_DIFFERS]);
    const plain = await registered({ location: PORT_A });
    expect(await answer([{ location: PORT_B, serial: SERIAL }], plain)).toEqual([UsbAudioRefusal.CARD_CHANGED, CardMismatch.SERIAL_DIFFERS]);
    // The registered socket, and the unit there states a serial where none was registered.
    expect(await answer([{ location: PORT_A, serial: SERIAL }], plain)).toEqual([UsbAudioRefusal.CARD_CHANGED, CardMismatch.SERIAL_DIFFERS]);
    // Another model in the registered socket.
    expect(await answer([{ location: PORT_A, product: 0x0008 }], plain)).toEqual([UsbAudioRefusal.CARD_CHANGED, CardMismatch.USB_ID_DIFFERS]);
    // Nothing connected but the built-in input.
    expect(await answer([], plain)).toEqual([UsbAudioRefusal.CARD_ABSENT, null]);
  });

  it('a PRE-COLUMN row (neither serial nor port) is read as "no serial" (R-FLEX row 107, Q96-09): any serial-less unit of the model, on any socket', async () => {
    for (const patch of [{ usbSerial: null, usbPort: null }, { usbSerial: undefined, usbPort: undefined }] as const) {
      const stored = await registered({ location: PORT_A }, patch);
      expect(await answer([{ location: PORT_A }], stored)).toEqual(['usb_01120000', 1, false]);
      expect(await answer([{ location: PORT_C }], stored)).toEqual(['usb_02100000', 1, true]);
      expect(await answer([], stored)).toEqual([UsbAudioRefusal.CARD_ABSENT, null]);
    }
  });

  it('SM-22: no stored row can be made to point at the built-in input - a row of a card that is not USB finds nothing on a macOS listing', async () => {
    const listing = await listingOf([{ location: PORT_A }]);
    for (const cardId of ['usb_01120000', 'DEMS_Built_in_Input', 'usb_00000000']) {
      const stored: RegisteredAudioInput = { deviceId: 'MIC-01', usbId: null, cardId, cardDevice: 0, inputNumber: 1, nativeChannels: 1 };
      const found = identifyRegisteredCard(listing, stored);
      // Under the name of the USB card: "changed", never the card. Under any other name: absent.
      expect(found.ok, cardId).toBe(false);
    }
    expect(listing.cards.every((card) => card.usb && card.usbId !== null)).toBe(true);
  });

  it('SM-05, for the adapter (row N9): with both same-model units connected the registered one is in NO card of the listing - the unchanged match says ABSENT, and the listing states the unit as undecided by its port so that the adapter can answer AMBIGUOUS', async () => {
    const stored = await registered({ location: PORT_A, serial: SERIAL, name: 'DEMS Duo 2', product: 2 });
    const both = [
      { location: PORT_A, serial: SERIAL, name: 'DEMS Duo 2', product: 2 },
      { location: PORT_C, name: 'DEMS Duo 2', product: 2 },
    ];
    expect(await answer(both, stored)).toEqual([UsbAudioRefusal.CARD_ABSENT, null]);
    const result = tied(treeOf(both), systemOf(both.map((unit) => ({ name: unit.name, inputs: 2 }))), helperOf(both.map((unit) => unit.name)));
    expect(result.undecided.filter((device) => device.usbId === stored.usbId && (device.usbSerial === stored.usbSerial || device.usbPort === stored.usbPort))).toEqual([
      { reason: MacosUndecidedReason.NAME_SHARED, usbId: '1a2b:0002', usbPort: '01120000', usbSerial: SERIAL },
    ]);
  });
});
