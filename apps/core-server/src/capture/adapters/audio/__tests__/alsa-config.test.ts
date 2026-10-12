// The generator of the shared-capture configuration (task 4 blueprint row 65, WP-08; decision
// text SR-1, entry 2; requirement AD-07 of the security addendum).
//
// THE DOUBLE. There is no ALSA on this host, so nothing here opens a sound card: the generator is
// a function from integers to text, and the test holds that text, byte for byte, to the template
// of the generator input-av ran (`apps/input-av/nvr/audio.py:466, 473-479`, quoted below; the
// source file is read by nobody at test time). The writer is a recording double. What stays
// unproven is named in `implementation/065_alsa_config_generator.md` (hardware checks 9A/H-07, 9A/H-08).
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, readTree } from '../../../../../test/static/scan';
import { PRODUCTION_ENVIRONMENT_KEYS } from '../../production-door';
import { CARD_FORMAT_PREFERENCE, CARD_LISTING_LIMITS, type CaptureCard } from '../card-listing';
import {
  ALSA_CONFIG_ENVIRONMENT_KEY,
  ALSA_CONFIG_REFUSED,
  ALSA_CONFIG_SUBPATH,
  ALSA_IPC_KEY_BASE,
  AlsaConfigError,
  AlsaConfigRefusal,
  SHARED_PCM_NAME,
  alsaConfigPath,
  alsaConfigText,
  ensureAlsaConfig,
  sharedCaptureKey,
  sharedCaptureOfCard,
  sharedPcmName,
  type AlsaConfigWriter,
  type SharedCaptureCard,
} from '../alsa-config';

/** A card with two inputs: card 1 of the listing, device 0. */
const DUO: SharedCaptureCard = { cardIndex: 1, deviceIndex: 0, channelCount: 2, rateHz: 48_000, format: 'S24_3LE' };
/** An interface with eight inputs: card 2 of the listing, device 0. */
const OCTO: SharedCaptureCard = { cardIndex: 2, deviceIndex: 0, channelCount: 8, rateHz: 48_000, format: 'S32_LE' };

const DUO_TEXT =
  'pcm.dems_1_0_shared {\n' +
  '  type dsnoop\n' +
  '  ipc_key 52032\n' +
  '  ipc_perm 0660\n' +
  '  slave { pcm "hw:CARD=1,DEV=0" channels 2 rate 48000 format S24_3LE period_size 1024 buffer_size 8192 }\n' +
  '}\n' +
  'pcm.dems_1_0 { type plug slave.pcm "dems_1_0_shared" }\n';
const OCTO_TEXT =
  'pcm.dems_2_0_shared {\n' +
  '  type dsnoop\n' +
  '  ipc_key 52064\n' +
  '  ipc_perm 0660\n' +
  '  slave { pcm "hw:CARD=2,DEV=0" channels 8 rate 48000 format S32_LE period_size 1024 buffer_size 8192 }\n' +
  '}\n' +
  'pcm.dems_2_0 { type plug slave.pcm "dems_2_0_shared" }\n';
const INCLUDE = '</usr/share/alsa/alsa.conf>\n';

const refusalOf = (work: () => unknown): string => {
  try {
    work();
  } catch (error) {
    if (error instanceof AlsaConfigError) return `${error.code}:${error.what}`;
    throw error;
  }
  return 'accepted';
};

describe('the text of the shared-capture configuration', () => {
  it('a 2-input card: one dsnoop that opens the hardware with both channels, one plug above it', () => {
    expect(alsaConfigText([DUO])).toBe(INCLUDE + DUO_TEXT);
  });

  it('a multi-input interface: all 8 channels are opened by the shared capture, whichever input a microphone takes', () => {
    expect(alsaConfigText([OCTO])).toBe(INCLUDE + OCTO_TEXT);
    // The generator has no parameter for a selected input: the count is the card's, never an input's.
    expect(alsaConfigText([OCTO])).toContain(' channels 8 ');
  });

  it('two cards: two configurations in one file, with distinct names and distinct keys', () => {
    const text = alsaConfigText([DUO, OCTO]);
    expect(text).toBe(INCLUDE + DUO_TEXT + OCTO_TEXT);
    expect([sharedPcmName(1, 0), sharedPcmName(2, 0)]).toEqual(['dems_1_0', 'dems_2_0']);
    expect([sharedCaptureKey(1, 0), sharedCaptureKey(2, 0)]).toEqual([52_032, 52_064]);
    expect(text.match(/^pcm\.dems_\d+_\d+ \{/gm)).toEqual(['pcm.dems_1_0 {', 'pcm.dems_2_0 {']);
  });

  it('two capture devices of one card are two shared captures', () => {
    const text = alsaConfigText([{ ...DUO, deviceIndex: 1 }, DUO]);
    expect(text.match(/hw:CARD=\d+,DEV=\d+/g)).toEqual(['hw:CARD=1,DEV=0', 'hw:CARD=1,DEV=1']);
    expect(text.match(/ipc_key \d+/g)).toEqual(['ipc_key 52032', 'ipc_key 52033']);
  });

  it('no card: the include line alone', () => {
    expect(alsaConfigText([])).toBe(INCLUDE);
  });

  it('equals the template of the input-av generator, line for line, with integers where it had the card name', () => {
    // `nvr/audio.py:466` and `:473-479`, as the source writes them (Python format fields in braces).
    const SOURCE_TEMPLATE =
      'pcm.{name}_shared {{\n  type dsnoop\n  ipc_key {key}\n  ipc_perm 0660\n' +
      '  slave {{ pcm "hw:CARD={card},DEV={dev}" channels {channels} ' +
      'rate {rate} ' +
      'format {format} ' +
      'period_size 1024 buffer_size 8192 }}\n}}\n' +
      'pcm.{name} {{ type plug slave.pcm "{name}_shared" }}';
    const fill = (card: SharedCaptureCard): string =>
      SOURCE_TEMPLATE.replaceAll('{{', '\u0001')
        .replaceAll('}}', '\u0002')
        .replaceAll('{name}', `dems_${String(card.cardIndex)}_${String(card.deviceIndex)}`)
        .replaceAll('{key}', String(ALSA_IPC_KEY_BASE + card.cardIndex * 32 + card.deviceIndex))
        .replaceAll('{card}', String(card.cardIndex))
        .replaceAll('{dev}', String(card.deviceIndex))
        .replaceAll('{channels}', String(card.channelCount))
        .replaceAll('{rate}', String(card.rateHz))
        .replaceAll('{format}', card.format)
        .replaceAll('\u0001', '{')
        .replaceAll('\u0002', '}');
    // The source joins its blocks with a line end and adds one (`"\n".join(blocks) + "\n"`).
    for (const cards of [[DUO], [OCTO], [DUO, OCTO], [{ cardIndex: 31, deviceIndex: 31, channelCount: 64, rateHz: 192_000, format: 'S16_LE' } as const]]) {
      expect(alsaConfigText(cards)).toBe(`${['</usr/share/alsa/alsa.conf>', ...cards.map(fill)].join('\n')}\n`);
    }
  });

  it('every format of the closed list is written as its own word', () => {
    for (const format of CARD_FORMAT_PREFERENCE) expect(alsaConfigText([{ ...DUO, format }])).toContain(` format ${format} period_size`);
  });
});

describe('deterministic: the same cards give the same bytes', () => {
  it('twice the same input, and the same cards in another order', () => {
    const first = alsaConfigText([DUO, OCTO]);
    expect(alsaConfigText([DUO, OCTO])).toBe(first);
    expect(alsaConfigText([OCTO, DUO])).toBe(first);
    expect(Buffer.from(alsaConfigText([{ ...OCTO }, { ...DUO }]), 'utf8').equals(Buffer.from(first, 'utf8'))).toBe(true);
  });

  it('the name and the key are functions of the two integers: 1,024 pairs, 1,024 names, 1,024 keys', () => {
    const names = new Set<string>();
    const keys = new Set<number>();
    for (let card = 0; card <= CARD_LISTING_LIMITS.cardIndexMax; card += 1) {
      for (let device = 0; device <= CARD_LISTING_LIMITS.deviceIndexMax; device += 1) {
        const name = sharedPcmName(card, device);
        expect(name).toMatch(SHARED_PCM_NAME);
        names.add(name);
        keys.add(sharedCaptureKey(card, device));
      }
    }
    expect([names.size, keys.size]).toEqual([1_024, 1_024]);
    expect([Math.min(...keys), Math.max(...keys)]).toEqual([52_000, 53_023]);
    expect(['dems_32_0', 'dems_0_32', 'dems_01_0', 'dems_1_0 ', 'dems_1_0\n', 'dems_a_0', 'dems_1_0_shared'].filter((text) => SHARED_PCM_NAME.test(text))).toEqual([]);
  });
});

describe('refusals: a value that is not of its shape writes no text', () => {
  const cases: readonly (readonly [string, unknown, string])[] = [
    ['a card index that is no whole number', { ...DUO, cardIndex: 1.5 }, 'CARD_INDEX'],
    ['a negative card index', { ...DUO, cardIndex: -1 }, 'CARD_INDEX'],
    ['a card index beyond 31', { ...DUO, cardIndex: 32 }, 'CARD_INDEX'],
    ['a card index given as text', { ...DUO, cardIndex: '1' }, 'CARD_INDEX'],
    ['a card index that is not a number', { ...DUO, cardIndex: Number.NaN }, 'CARD_INDEX'],
    ['a device index that is no whole number', { ...DUO, deviceIndex: 0.25 }, 'DEVICE_INDEX'],
    ['a negative device index', { ...DUO, deviceIndex: -1 }, 'DEVICE_INDEX'],
    ['a device index beyond 31', { ...DUO, deviceIndex: 32 }, 'DEVICE_INDEX'],
    ['no channel', { ...DUO, channelCount: 0 }, 'CHANNELS'],
    ['a negative channel count', { ...DUO, channelCount: -2 }, 'CHANNELS'],
    ['a channel count that is no whole number', { ...DUO, channelCount: 2.5 }, 'CHANNELS'],
    ['more channels than 64', { ...DUO, channelCount: 65 }, 'CHANNELS'],
    ['a rate below 8,000', { ...DUO, rateHz: 7_999 }, 'RATE'],
    ['a rate above 192,000', { ...DUO, rateHz: 192_001 }, 'RATE'],
    ['a rate that is no whole number', { ...DUO, rateHz: 44_100.5 }, 'RATE'],
    ['a format outside the closed list', { ...DUO, format: 'FLOAT_LE' }, 'FORMAT'],
    ['a format that carries more text', { ...DUO, format: 'S16_LE }\n}\npcm.x { type hw card 0 }' }, 'FORMAT'],
    ['a format that is no text', { ...DUO, format: 16 }, 'FORMAT'],
  ];

  it.each(cases)('%s', (_name, card, what) => {
    expect(refusalOf(() => alsaConfigText([OCTO, card as SharedCaptureCard]))).toBe(`${ALSA_CONFIG_REFUSED}:${what}`);
  });

  it('one card and device named twice (a card has one shared capture and one rate)', () => {
    expect(refusalOf(() => alsaConfigText([DUO, OCTO, { ...DUO, rateHz: 44_100 }]))).toBe(`${ALSA_CONFIG_REFUSED}:DUPLICATE`);
  });

  it('more entries than a listing can hold, and a value that is no list', () => {
    const many = Array.from({ length: CARD_LISTING_LIMITS.entries + 1 }, (_unused, index): SharedCaptureCard => ({ ...DUO, cardIndex: index % 32, deviceIndex: Math.floor(index / 32) }));
    expect(refusalOf(() => alsaConfigText(many))).toBe(`${ALSA_CONFIG_REFUSED}:ENTRIES`);
    expect(alsaConfigText(many.slice(0, CARD_LISTING_LIMITS.entries)).match(/type dsnoop/g)).toHaveLength(32);
    expect(refusalOf(() => alsaConfigText('dems' as unknown as SharedCaptureCard[]))).toBe(`${ALSA_CONFIG_REFUSED}:ENTRIES`);
  });

  it('the refusal carries a code and no value', () => {
    const error = new AlsaConfigError(AlsaConfigRefusal.FORMAT);
    expect([error.code, error.what, error.message]).toEqual(['ALSA_CONFIG_REFUSED', 'FORMAT', 'a value of the shared-capture configuration is not of its shape']);
  });
});

describe('AD-07: no text a device announced can reach the configuration or its file name', () => {
  /** What a hostile device could announce, and what the kernel would derive from it. */
  const HOSTILE = ['EVIL8', 'Evil Interface }\npcm.!default { type hw card 9 }', 'ffff:0666', 'usb-0000:00:14.0-9', '$(reboot)', '"; rm -rf /', '../../etc/asound.conf', 'dems_9_9'];
  const hostileCard = (base: SharedCaptureCard): CaptureCard & Record<string, unknown> => ({
    cardIndex: base.cardIndex,
    deviceIndex: base.deviceIndex,
    cardId: 'EVIL8',
    usb: true,
    usbId: 'ffff:0666',
    usbPort: 'usb-0000:00:14.0-9',
    product: 'Evil Interface }\npcm.!default { type hw card 9 }',
    channelCount: base.channelCount,
    factsSource: 'STREAM',
    formats: [base.format],
    nativeFormat: base.format,
    sampleBits: [24],
    ratesHz: [base.rateHz],
    rateRangeHz: null,
    // Members no card of the listing has: a generator that copied its input would write them.
    name: '$(reboot)',
    pcm: '"; rm -rf /',
    path: '../../etc/asound.conf',
    shared: 'dems_9_9',
  });

  it('a card of the listing with hostile text gives exactly the bytes of the bare integers', () => {
    const cards = [hostileCard(DUO), hostileCard(OCTO)];
    const text = alsaConfigText(cards.map((card) => sharedCaptureOfCard(card)));
    expect(text).toBe(alsaConfigText([DUO, OCTO]));
    for (const planted of HOSTILE) expect(text.includes(planted), planted).toBe(false);
    // The same objects handed over as they are: only the five members are read.
    const direct = alsaConfigText(cards.map((card) => ({ ...card, rateHz: 48_000, format: card.nativeFormat })));
    expect(direct).toBe(alsaConfigText([DUO, OCTO]));
  });

  it('every line of any output is a literal line of this unit with decimal digits and a format of the closed list in it', () => {
    const LINES = [
      /^<\/usr\/share\/alsa\/alsa\.conf>$/,
      /^pcm\.dems_\d{1,2}_\d{1,2}_shared \{$/,
      /^ {2}type dsnoop$/,
      /^ {2}ipc_key 5[23]\d{3}$/,
      /^ {2}ipc_perm 0660$/,
      /^ {2}slave \{ pcm "hw:CARD=\d{1,2},DEV=\d{1,2}" channels \d{1,2} rate \d{4,6} format (?:S32_LE|S24_3LE|S24_LE|S16_LE) period_size 1024 buffer_size 8192 \}$/,
      /^\}$/,
      /^pcm\.dems_(\d{1,2}_\d{1,2}) \{ type plug slave\.pcm "dems_\1_shared" \}$/,
    ];
    const text = alsaConfigText([hostileCard(OCTO), hostileCard(DUO), hostileCard({ cardIndex: 31, deviceIndex: 31, channelCount: 64, rateHz: 192_000, format: 'S16_LE' })].map((card) => sharedCaptureOfCard(card, card.ratesHz[0])));
    const lines = text.split('\n');
    expect(lines.pop()).toBe('');
    expect(lines).toHaveLength(1 + 3 * 7);
    expect(lines.filter((line) => !LINES.some((shape) => shape.test(line)))).toEqual([]);
  });

  it('the generator reads no text member of a card and imports no module of the host (source check, with a control)', () => {
    const TEXT_MEMBER = /\b(?:cardId|usbId|usbPort|product)\b/g;
    const files = codeOnly(readTree(WORKSPACE).filter((file) => file.path.startsWith('src/capture/adapters/audio/alsa-config')));
    expect(files.map((file) => file.path)).toEqual(['src/capture/adapters/audio/alsa-config-writer.ts', 'src/capture/adapters/audio/alsa-config.ts']);
    for (const file of files) expect(file.text.match(TEXT_MEMBER), file.path).toBeNull();
    const generator = files.find((file) => file.path.endsWith('/alsa-config.ts'))?.text ?? '';
    expect(generator.match(/from\s+'[^']+'/g)).toEqual(["from './card-listing'"]);
    // Control: the listing itself, which does hold the text members, is seen by the same pattern.
    const listing = codeOnly(readTree(WORKSPACE).filter((file) => file.path === 'src/capture/adapters/audio/card-listing.ts'))[0]?.text ?? '';
    expect((listing.match(TEXT_MEMBER) ?? []).length).toBeGreaterThan(4);
  });
});

describe('the entry of a card of the live listing', () => {
  const card = (ratesHz: readonly number[], channelCount = 6): Pick<CaptureCard, 'cardIndex' | 'deviceIndex' | 'channelCount' | 'nativeFormat' | 'ratesHz' | 'rateRangeHz'> => ({
    cardIndex: 3,
    deviceIndex: 0,
    channelCount,
    nativeFormat: 'S32_LE',
    ratesHz,
    rateRangeHz: null,
  });

  it('the native channel count, the native format and the one rate of the card', () => {
    expect(sharedCaptureOfCard(card([44_100, 48_000, 96_000]))).toEqual({ cardIndex: 3, deviceIndex: 0, channelCount: 6, rateHz: 48_000, format: 'S32_LE' });
    expect(sharedCaptureOfCard(card([44_100, 48_000, 96_000]), 96_000).rateHz).toBe(96_000);
  });

  it('a rate the card does not offer: 48,000 when it offers that, else its lowest (the rule of the listing)', () => {
    expect(sharedCaptureOfCard(card([44_100, 48_000]), 96_000).rateHz).toBe(48_000);
    expect(sharedCaptureOfCard(card([44_100, 88_200]), 48_000).rateHz).toBe(44_100);
  });

  it('a wanted rate outside the range is refused', () => {
    expect(refusalOf(() => sharedCaptureOfCard(card([48_000]), 0))).toBe(`${ALSA_CONFIG_REFUSED}:RATE`);
    expect(refusalOf(() => sharedCaptureOfCard(card([48_000]), 48_000.5))).toBe(`${ALSA_CONFIG_REFUSED}:RATE`);
    expect(refusalOf(() => sharedCaptureOfCard(card([48_000], 65)))).toBe(`${ALSA_CONFIG_REFUSED}:CHANNELS`);
  });
});

describe('the file: under the run directory only, through the writer handed in', () => {
  const RUN = '/data/dems/run/capture';

  it('the path is the run directory and two literals', () => {
    expect(ALSA_CONFIG_SUBPATH).toBe('alsa/dems-alsa.conf');
    expect(alsaConfigPath(RUN)).toBe('/data/dems/run/capture/alsa/dems-alsa.conf');
    expect(alsaConfigPath(`${RUN}/`)).toBe('/data/dems/run/capture/alsa/dems-alsa.conf');
    expect(alsaConfigPath('/Users/a b/Library/Application Support/dems/run/capture')).toBe('/Users/a b/Library/Application Support/dems/run/capture/alsa/dems-alsa.conf');
  });

  it.each([
    ['a relative path', 'data/run'],
    ['an empty text', ''],
    ['the root alone', '/'],
    ['a dot-dot segment', '/data/../etc'],
    ['a dot segment', '/data/./run'],
    ['an empty segment', '/data//run'],
    ['a line end', '/data/run\n/etc'],
    ['a shell mark', '/data/run;x'],
    ['a NUL', '/data/run\0'],
    ['a value that is no text', 7 as unknown as string],
    ['a path beyond the bound', `/${'a'.repeat(901)}`],
  ])('refuses %s', (_name, runDir) => {
    expect(refusalOf(() => alsaConfigPath(runDir))).toBe(`${ALSA_CONFIG_REFUSED}:RUN_DIRECTORY`);
  });

  const recorder = (): { writer: AlsaConfigWriter; calls: { path: string; text: string }[] } => {
    const calls: { path: string; text: string }[] = [];
    return { calls, writer: { replace: (path, text) => (calls.push({ path, text }), Promise.resolve()) } };
  };

  it('one write of the whole text to the one path; the answer names the path, the key and the name a helper opens', async () => {
    const { writer, calls } = recorder();
    const result = await ensureAlsaConfig(writer, RUN, [OCTO, DUO]);
    expect(calls).toEqual([{ path: '/data/dems/run/capture/alsa/dems-alsa.conf', text: INCLUDE + DUO_TEXT + OCTO_TEXT }]);
    expect(result.path).toBe('/data/dems/run/capture/alsa/dems-alsa.conf');
    expect(result.text).toBe(INCLUDE + DUO_TEXT + OCTO_TEXT);
    expect(result.environment).toEqual({ ALSA_CONFIG_PATH: '/data/dems/run/capture/alsa/dems-alsa.conf' });
    expect(result.pcms).toEqual([
      { cardIndex: 1, deviceIndex: 0, name: 'dems_1_0' },
      { cardIndex: 2, deviceIndex: 0, name: 'dems_2_0' },
    ]);
  });

  it('the key is the one key the production door hands to a program', () => {
    expect(ALSA_CONFIG_ENVIRONMENT_KEY).toBe('ALSA_CONFIG_PATH');
    expect([...PRODUCTION_ENVIRONMENT_KEYS]).toEqual([ALSA_CONFIG_ENVIRONMENT_KEY]);
  });

  it('a refused card or a refused run directory writes nothing', async () => {
    const { writer, calls } = recorder();
    await expect(ensureAlsaConfig(writer, RUN, [DUO, { ...OCTO, channelCount: 65 }])).rejects.toMatchObject({ code: 'ALSA_CONFIG_REFUSED', what: 'CHANNELS' });
    await expect(ensureAlsaConfig(writer, 'run', [DUO])).rejects.toMatchObject({ code: 'ALSA_CONFIG_REFUSED', what: 'RUN_DIRECTORY' });
    expect(calls).toEqual([]);
  });

  it('a failure of the writer is the caller\'s to see: it is not swallowed', async () => {
    const failing: AlsaConfigWriter = { replace: () => Promise.reject(new Error('disk')) };
    await expect(ensureAlsaConfig(failing, RUN, [DUO])).rejects.toThrow('disk');
  });
});
