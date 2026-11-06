// The idle microphone meters (decisions D51/D53; row 91c). THE DOUBLES: a door that starts nothing
// (each call is a scripted process the test ends), a listing of fixed cards, a writer that keeps the
// text in memory and manual timers. Nothing here opens a card. NOT proven here: the pinned helper on
// the bench's card (HANMUS BOMGE, ALSA card 1, 4 channels) - a hardware check.
import { describe, expect, it } from 'vitest';
import { manualTimers, trustedInspector } from '../../local/__tests__/mic-support';
import { MIC_LINUX_HELPER_TABLE, linuxMicLevelArguments } from '../../local/mic-helper-args';
import type { ProductionExit, ProductionProcess, ProductionProcessOptions } from '../../production-door';
import { alsaConfigText, sharedCaptureOfCard, type AlsaConfigWriter } from '../alsa-config';
import { CardFactsSource, type CaptureCard, type CardListing } from '../card-listing';
import { IDLE_METER_HELPERS_MAX, IDLE_METER_LEASE_MS, IdleMeterNoticeCode, createIdleMeters, type IdleMeterInput, type IdleMeterLevel, type IdleMeterNotice, type IdleMetersDeps } from '../idle-meter';
import type { RegisteredAudioInput } from '../usb-audio-production';

const HELPER = '/opt/dems/bin/ffmpeg';
const GUARD = '/opt/dems/bin/capture-guard';
const RUN_DIR = '/var/lib/dems/run/capture';

function card(patch: Partial<CaptureCard> & Pick<CaptureCard, 'cardIndex' | 'cardId'>): CaptureCard {
  return Object.freeze({
    deviceIndex: 0,
    usb: true,
    usbId: '1234:5678',
    usbPort: '1-1',
    usbSerial: null,
    product: 'Synthetic USB Audio',
    channelCount: 4,
    factsSource: CardFactsSource.STREAM,
    formats: ['S32_LE'],
    nativeFormat: 'S32_LE',
    sampleBits: [32],
    ratesHz: [48_000],
    rateRangeHz: null,
    ...patch,
  }) as CaptureCard;
}

/** The bench's card: one 4-channel USB card at index 1; another model at index 2. */
const BENCH = card({ cardIndex: 1, cardId: 'BOMGE' });
const OTHER = card({ cardIndex: 2, cardId: 'EVO8', usbId: '2708:0006', usbPort: '1-2', channelCount: 2 });
const THIRD = card({ cardIndex: 3, cardId: 'UMC', usbId: '1397:0509', usbPort: '1-3', channelCount: 2 });

const row = (deviceId: string, of: CaptureCard, inputNumber: number): RegisteredAudioInput => ({ deviceId, usbId: of.usbId, cardId: of.cardId, cardDevice: of.deviceIndex, inputNumber, nativeChannels: of.channelCount, usbSerial: null, usbPort: of.usbPort });

interface FakeProcess extends ProductionProcess {
  readonly options: ProductionProcessOptions;
  inputEnded: boolean;
  signals: string[];
  end(exit?: Partial<ProductionExit>): void;
  output(bytes: Buffer): void;
}

function fakeDoor(script: { refuseStart?: boolean; obeyEndOfInput?: boolean } = {}) {
  const calls: FakeProcess[] = [];
  const door = (options: ProductionProcessOptions): ProductionProcess => {
    let alive = true;
    let resolveEnded: (exit: ProductionExit) => void = () => {};
    const ended = new Promise<ProductionExit>((resolve) => {
      resolveEnded = resolve;
    });
    const fake: FakeProcess = {
      options,
      pid: 7_000 + calls.length,
      started: script.refuseStart === true ? Promise.reject(Object.assign(new Error('refused'), { code: 'PROGRAM_NOT_STARTED' })) : Promise.resolve(),
      ended,
      alive: () => alive,
      inputEnded: false,
      signals: [],
      endInput() {
        fake.inputEnded = true;
        if (script.obeyEndOfInput !== false) fake.end({ exitCode: 0 });
      },
      kill(signal) {
        fake.signals.push(signal);
        if (signal === 'SIGKILL') fake.end({ exitCode: null, signal });
      },
      end(exit = {}) {
        if (!alive) return;
        alive = false;
        resolveEnded({ exitCode: 0, signal: null, spawnFailed: false, diagnostics: '', output: '', ...exit });
      },
      output(bytes) {
        options.onOutput?.(bytes);
      },
    };
    fake.started.catch(() => {});
    if (script.refuseStart === true) fake.end({ spawnFailed: true, exitCode: null });
    calls.push(fake);
    return fake;
  };
  return { door, calls, live: () => calls.filter((call) => call.alive()) };
}

/** Lets every pending promise of the unit run. */
const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
};

function harness(patch: { cards?: CaptureCard[]; rows?: RegisteredAudioInput[]; inputs?: IdleMeterInput[]; door?: ReturnType<typeof fakeDoor>; deps?: Partial<IdleMetersDeps> } = {}) {
  const timers = manualTimers();
  const door = patch.door ?? fakeDoor();
  const state = {
    cards: patch.cards ?? [BENCH],
    rows: patch.rows ?? [row('MIC-03', BENCH, 1), row('MIC-04', BENCH, 2)],
    inputs: patch.inputs ?? ([{ deviceId: 'MIC-03', role: 'PRIMARY' }, { deviceId: 'MIC-04', role: 'STANDBY' }] as IdleMeterInput[]),
    session: false,
    clock: 1_000_000,
    listings: 0,
    writes: [] as { path: string; text: string }[],
  };
  const published: (readonly IdleMeterLevel[])[] = [];
  const notices: IdleMeterNotice[] = [];
  const writer: AlsaConfigWriter = {
    replace: async (path, text) => {
      state.writes.push({ path, text });
    },
  };
  const meters = createIdleMeters({
    selection: async () => state.inputs,
    registered: async (deviceId) => state.rows.find((entry) => entry.deviceId === deviceId) ?? null,
    cards: {
      list: async (): Promise<CardListing> => {
        state.listings += 1;
        return { cards: state.cards, truncated: false, skipped: 0 };
      },
    },
    configWriter: writer,
    helperProgram: HELPER,
    guardProgram: GUARD,
    runDir: RUN_DIR,
    timers,
    now: () => state.clock,
    sessionActive: () => state.session,
    publish: (levels) => published.push(levels),
    onNotice: (notice) => notices.push(notice),
    door: door.door,
    inspect: trustedInspector(),
    ...patch.deps,
  });
  return { meters, timers, door, state, published, notices };
}

/** One 50 ms window of a 4-channel card: input k at amplitude levels[k - 1], a square wave. */
function window4(levels: readonly number[], frames = 2_400): Buffer {
  const out = Buffer.alloc(frames * 4 * 4);
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < 4; channel += 1) out.writeFloatLE((frame % 2 === 0 ? 1 : -1) * (levels[channel] ?? 0), (frame * 4 + channel) * 4);
  }
  return out;
}

describe('the lease', () => {
  it('a hold answers the end of a 30 s lease; a renewal moves it; with no lease nothing starts', async () => {
    const h = harness();
    await settle();
    expect(h.door.calls).toHaveLength(0);
    expect(h.meters.hold('OPR-001')).toEqual({ expiresAt: 1_000_000 + IDLE_METER_LEASE_MS });
    await settle();
    expect(h.door.calls).toHaveLength(1);
    h.state.clock += 10_000;
    expect(h.meters.hold('OPR-001')).toEqual({ expiresAt: 1_010_000 + IDLE_METER_LEASE_MS });
    await settle();
    // The renewal starts no second helper for the card that is read already.
    expect(h.door.calls).toHaveLength(1);
    // The first timer was cancelled by the renewal: only the second one ends the lease.
    expect(h.timers.pending().filter((ms) => ms === IDLE_METER_LEASE_MS)).toHaveLength(1);
  });

  it('the lease ends after 30 s without a renewal: the helper is stopped by the end of its input; the next hold starts it again', async () => {
    const h = harness();
    h.meters.hold('OPR-001');
    await settle();
    const [first] = h.door.calls;
    expect(h.timers.fire(IDLE_METER_LEASE_MS)).toBe(true);
    await settle();
    expect(first?.inputEnded).toBe(true);
    expect(first?.alive()).toBe(false);
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(2);
    expect(h.door.live()).toHaveLength(1);
  });

  it('two operators: the helper lives until the last lease ends', async () => {
    const h = harness();
    h.meters.hold('OPR-001');
    h.state.clock += 5_000;
    h.meters.hold('OPR-002');
    await settle();
    expect(h.door.calls).toHaveLength(1);
    expect(h.timers.fire(IDLE_METER_LEASE_MS)).toBe(true);
    await settle();
    expect(h.door.live()).toHaveLength(1);
    expect(h.timers.fire(IDLE_METER_LEASE_MS)).toBe(true);
    await settle();
    expect(h.door.live()).toHaveLength(0);
  });

  it('an operator id that is not of its shape takes no lease', async () => {
    const h = harness();
    for (const id of ['', 'x'.repeat(129), 7 as unknown as string]) expect(h.meters.hold(id).expiresAt).toBe(1_000_000 + IDLE_METER_LEASE_MS);
    await settle();
    expect(h.door.calls).toHaveLength(0);
  });
});

describe('what is started, through the production door', () => {
  it('ONE helper for the card that holds PRIMARY and STANDBY: the guard, the helper path, the idle level list of the live card, the configuration\'s one key', async () => {
    const h = harness();
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(1);
    const options = h.door.calls[0]!.options;
    expect(options.command).toBe(GUARD);
    expect([...options.args]).toEqual([HELPER, ...linuxMicLevelArguments({ cardIndex: 1, deviceIndex: 0, channelCount: 4 })]);
    expect([...options.args]).toEqual([
      HELPER,
      '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning',
      '-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-ch_layout', '4C', '-sample_rate', '48000', '-i', 'dems_1_0',
      '-vn', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', 'pipe:1',
    ]);
    expect(options.env).toEqual({ ALSA_CONFIG_PATH: `${RUN_DIR}/alsa/dems-alsa.conf` });
    expect(options.message).toBeNull();
    // The configuration is the one a session writes for the same card: the same entry, so the same IPC key.
    expect(h.state.writes).toEqual([{ path: `${RUN_DIR}/alsa/dems-alsa.conf`, text: alsaConfigText([sharedCaptureOfCard(BENCH, 48_000)]) }]);
    expect(MIC_LINUX_HELPER_TABLE.levelOutput).toEqual(['-vn', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', 'pipe:1']);
  });

  it('publishes the level of input 1 as PRIMARY (MIC-03) and input 2 as STANDBY (MIC-04), per 50 ms window; inputs 3 and 4 are not read', async () => {
    const h = harness();
    h.meters.hold('OPR-001');
    await settle();
    const helper = h.door.calls[0]!;
    // Cut the window in two chunks anywhere: one publication when it is complete.
    const bytes = window4([0.5, 1, 1, 1]);
    helper.output(bytes.subarray(0, 1_001));
    expect(h.published).toEqual([]);
    helper.output(bytes.subarray(1_001));
    expect(h.published).toHaveLength(1);
    const [primary, standby, ...rest] = h.published[0]!;
    expect(rest).toEqual([]);
    expect(primary).toMatchObject({ deviceId: 'MIC-03', role: 'PRIMARY', clipped: false });
    expect(primary?.dbfs).toBeCloseTo(-6.0206, 3);
    expect(standby).toEqual({ deviceId: 'MIC-04', role: 'STANDBY', dbfs: 0, clipped: true });
  });

  // Row W4-6 (D235): the site's selector (diagnosis F2/F5) - MIC-03..MIC-06 on inputs 1-4 of ONE 4-input card, channel 1
  // PRIMARY and channels 2-4 all STANDBY. Three levels share the role, so each must carry its mic id: that is what the
  // engine places it by (`idleLevelsAsTelemetry`, shared `feedCaptureLevels`).
  it('row W4-6: one 4-input card with four selector lines publishes four levels, each with its own mic id, in input order', async () => {
    const h = harness({
      rows: [row('MIC-03', BENCH, 1), row('MIC-04', BENCH, 2), row('MIC-05', BENCH, 3), row('MIC-06', BENCH, 4)],
      inputs: [
        { deviceId: 'MIC-03', role: 'PRIMARY' },
        { deviceId: 'MIC-04', role: 'STANDBY' },
        { deviceId: 'MIC-05', role: 'STANDBY' },
        { deviceId: 'MIC-06', role: 'STANDBY' },
      ],
    });
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(1);
    h.door.calls[0]!.output(window4([0.5, 0.1, 0.01, 0.001]));
    expect(h.published).toHaveLength(1);
    const levels = h.published[0]!;
    expect(levels.map((level) => [level.deviceId, level.role])).toEqual([
      ['MIC-03', 'PRIMARY'],
      ['MIC-04', 'STANDBY'],
      ['MIC-05', 'STANDBY'],
      ['MIC-06', 'STANDBY'],
    ]);
    expect(levels.map((level) => Math.round(level.dbfs))).toEqual([-6, -20, -40, -60]);
  });

  it('two cards: two helpers, one per card; each publishes its own input; the configuration holds both entries', async () => {
    const h = harness({ cards: [BENCH, OTHER], rows: [row('MIC-03', BENCH, 1), row('MIC-07', OTHER, 2)], inputs: [{ deviceId: 'MIC-07', role: 'STANDBY' }, { deviceId: 'MIC-03', role: 'PRIMARY' }] });
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls.map((call) => call.options.args[call.options.args.indexOf('-i') + 1])).toEqual(['dems_1_0', 'dems_2_0']);
    expect(h.state.writes.at(-1)?.text).toBe(alsaConfigText([sharedCaptureOfCard(BENCH, 48_000), sharedCaptureOfCard(OTHER, 48_000)]));
    const pcm2 = Buffer.alloc(2_400 * 2 * 4);
    for (let frame = 0; frame < 2_400; frame += 1) pcm2.writeFloatLE(0.1, (frame * 2 + 1) * 4);
    h.door.calls[1]!.output(pcm2);
    expect(h.published).toHaveLength(1);
    expect(h.published[0]?.map((level) => level.deviceId)).toEqual(['MIC-07']);
    expect(h.published[0]?.[0]?.dbfs).toBeCloseTo(-20, 3);
  });

  it(`at most ${String(IDLE_METER_HELPERS_MAX)} helpers; another role than PRIMARY or STANDBY is not read`, async () => {
    const h = harness({
      cards: [BENCH, OTHER, THIRD],
      rows: [row('MIC-03', BENCH, 1), row('MIC-07', OTHER, 1), row('MIC-09', THIRD, 1)],
      inputs: [{ deviceId: 'MIC-09', role: 'TERTIARY' as 'PRIMARY' }, { deviceId: 'MIC-03', role: 'PRIMARY' }, { deviceId: 'MIC-07', role: 'STANDBY' }],
    });
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(2);
    expect(h.door.calls.map((call) => call.options.args[call.options.args.indexOf('-i') + 1])).toEqual(['dems_1_0', 'dems_2_0']);
  });

  it('a card found at another index after a re-plug is read at its NEW index (re-identified, never by the index)', async () => {
    const h = harness({ cards: [card({ cardIndex: 4, cardId: 'BOMGE' })] });
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls[0]?.options.args).toContain('dems_4_0');
  });
});

describe('a card that is not read: no level, no fault, no retry before the next hold', () => {
  it('the card is not connected: nothing starts, the inputs get no level, one notice per input; the next hold looks again', async () => {
    const h = harness({ cards: [] });
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(0);
    expect(h.published).toEqual([]);
    expect(h.notices.map((notice) => [notice.code, notice.deviceId, notice.detail])).toEqual([
      [IdleMeterNoticeCode.CARD_NOT_READ, 'MIC-03', 'AUDIO_CARD_ABSENT'],
      [IdleMeterNoticeCode.CARD_NOT_READ, 'MIC-04', 'AUDIO_CARD_ABSENT'],
    ]);
    expect(h.state.writes).toEqual([]);
    expect(h.state.listings).toBe(1);
    // No timer of a retry was set: only the lease.
    expect(h.timers.pending()).toEqual([IDLE_METER_LEASE_MS]);
    h.state.cards = [BENCH];
    h.meters.hold('OPR-001');
    await settle();
    expect(h.state.listings).toBe(2);
    expect(h.door.calls).toHaveLength(1);
  });

  it('another unit of the model (another serial) is not taken for the registered card', async () => {
    const h = harness({ cards: [card({ cardIndex: 1, cardId: 'BOMGE', usbSerial: 'OTHER-SERIAL' })] });
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(0);
    expect(h.notices[0]).toEqual({ code: IdleMeterNoticeCode.CARD_NOT_READ, deviceId: 'MIC-03', detail: 'AUDIO_CARD_CHANGED' });
  });

  it('a card of a guessed channel count, an input beyond the card and a card without the transport rate are not read', async () => {
    for (const [cards, rows, detail] of [
      [[card({ cardIndex: 1, cardId: 'BOMGE', factsSource: CardFactsSource.ASSUMED })], [row('MIC-03', BENCH, 1)], 'CARD_FACTS_UNKNOWN'],
      [[card({ cardIndex: 1, cardId: 'BOMGE', channelCount: 2 })], [{ ...row('MIC-03', BENCH, 3), nativeChannels: 4 }], 'INPUT_BEYOND_CARD'],
      [[card({ cardIndex: 1, cardId: 'BOMGE', ratesHz: [44_100] })], [row('MIC-03', BENCH, 1)], 'CARD_RATE_UNSUPPORTED'],
    ] as const) {
      const h = harness({ cards: [...cards], rows: [...rows], inputs: [{ deviceId: 'MIC-03', role: 'PRIMARY' }] });
      h.meters.hold('OPR-001');
      await settle();
      expect(h.door.calls, detail).toHaveLength(0);
      expect(h.notices.map((notice) => notice.detail), detail).toEqual([detail]);
    }
  });

  it('the card vanishes while it is read: the helper ends, the meters fall to NO SIGNAL (nothing is published), nothing is restarted until the next hold', async () => {
    const h = harness();
    h.meters.hold('OPR-001');
    await settle();
    h.door.calls[0]!.end({ exitCode: 1 });
    await settle();
    expect(h.notices.map((notice) => [notice.code, notice.detail])).toEqual([[IdleMeterNoticeCode.HELPER_ENDED, 'EXIT_1']]);
    expect(h.door.calls).toHaveLength(1);
    expect(h.timers.pending()).toEqual([IDLE_METER_LEASE_MS]);
    h.state.cards = [];
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(1);
    expect(h.published).toEqual([]);
  });

  it('row W4-7 (D238): a helper notice names EVERY microphone of its card (the reach of each), and the next hold of a lost card tells each microphone CARD_NOT_READ', async () => {
    const h = harness();
    h.meters.hold('OPR-001');
    await settle();
    h.door.calls[0]!.end({ exitCode: 1 });
    await settle();
    expect(h.notices).toEqual([{ code: IdleMeterNoticeCode.HELPER_ENDED, deviceId: 'MIC-03', detail: 'EXIT_1', deviceIds: ['MIC-03', 'MIC-04'] }]);
    h.notices.length = 0;
    h.state.cards = [];
    h.timers.fire(IDLE_METER_LEASE_MS);
    await settle();
    h.meters.hold('OPR-001');
    await settle();
    expect(h.notices.map((notice) => [notice.code, notice.deviceId, notice.deviceIds])).toEqual([
      [IdleMeterNoticeCode.CARD_NOT_READ, 'MIC-03', undefined],
      [IdleMeterNoticeCode.CARD_NOT_READ, 'MIC-04', undefined],
    ]);
    const refused = harness({ door: fakeDoor({ refuseStart: true }) });
    refused.meters.hold('OPR-001');
    await settle();
    expect(refused.notices.find((notice) => notice.code === IdleMeterNoticeCode.HELPER_NOT_STARTED)?.deviceIds).toEqual(['MIC-03', 'MIC-04']);
  });

  it('a listing that fails, a selection that fails, a refused program and a door that does not start are told and start nothing; hold never throws', async () => {
    const listing = harness({ deps: { cards: { list: async () => Promise.reject(Object.assign(new Error('x'), { code: 'EACCES' })) } } });
    expect(() => listing.meters.hold('OPR-001')).not.toThrow();
    await settle();
    expect(listing.notices.map((notice) => [notice.code, notice.detail])).toEqual([[IdleMeterNoticeCode.LISTING_FAILED, 'EACCES']]);
    const selection = harness({ deps: { selection: async () => Promise.reject(new Error('db')) } });
    selection.meters.hold('OPR-001');
    await settle();
    expect(selection.notices.map((notice) => notice.code)).toEqual([IdleMeterNoticeCode.SELECTION_FAILED]);
    const program = harness({ deps: { inspect: () => ({ ...trustedInspector()(), file: { ownerUid: 501, mode: 0o777 } }) } });
    program.meters.hold('OPR-001');
    await settle();
    expect(program.door.calls).toHaveLength(0);
    expect(program.notices.map((notice) => [notice.code, notice.detail])).toEqual([[IdleMeterNoticeCode.PROGRAM_REFUSED, 'HELPER_FILE_WRITABLE']]);
    const refused = harness({ door: fakeDoor({ refuseStart: true }) });
    refused.meters.hold('OPR-001');
    await settle();
    expect(refused.notices.map((notice) => notice.code)).toContain(IdleMeterNoticeCode.HELPER_NOT_STARTED);
  });
});

describe('the order with a session', () => {
  it('stopAndWait: suspends, ends the guard\'s input and resolves only when the helper has ENDED; a hold while suspended starts nothing', async () => {
    const door = fakeDoor({ obeyEndOfInput: false });
    const h = harness({ door });
    h.meters.hold('OPR-001');
    await settle();
    const helper = door.calls[0]!;
    let resolved = false;
    const stopped = h.meters.stopAndWait().then(() => {
      resolved = true;
    });
    await settle();
    expect(helper.inputEnded).toBe(true);
    expect(resolved).toBe(false);
    // The guard did not obey the end of its input: SIGTERM after 3 s, SIGKILL after 2 s more.
    expect(h.timers.fire(3_000)).toBe(true);
    expect(helper.signals).toEqual(['SIGTERM']);
    await settle();
    expect(resolved).toBe(false);
    expect(h.timers.fire(5_000)).toBe(true);
    await stopped;
    expect(resolved).toBe(true);
    expect(helper.signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(h.notices.map((notice) => notice.code)).toEqual([IdleMeterNoticeCode.HELPER_SIGNALLED]);
    h.meters.hold('OPR-001');
    await settle();
    expect(door.calls).toHaveLength(1);
  });

  it('stopAndWait during a start in flight: the start is waited for and starts nothing', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const h = harness({
      deps: {
        selection: async () => {
          await gate;
          return [{ deviceId: 'MIC-03', role: 'PRIMARY' }];
        },
      },
    });
    h.meters.hold('OPR-001');
    await settle();
    let resolved = false;
    const stopped = h.meters.stopAndWait().then(() => {
      resolved = true;
    });
    await settle();
    expect(resolved).toBe(false);
    release();
    await stopped;
    expect(h.door.calls).toHaveLength(0);
  });

  it('resume after SEALED: a lease still held starts the helper again; without a lease nothing starts', async () => {
    const h = harness();
    h.meters.hold('OPR-001');
    await settle();
    await h.meters.stopAndWait();
    expect(h.door.live()).toHaveLength(0);
    h.meters.resume();
    await settle();
    expect(h.door.calls).toHaveLength(2);
    expect(h.door.live()).toHaveLength(1);
    await h.meters.stopAndWait();
    expect(h.timers.fire(IDLE_METER_LEASE_MS)).toBe(true);
    h.meters.resume();
    await settle();
    expect(h.door.calls).toHaveLength(2);
  });

  it('while a session is active nothing starts and nothing is published, even with a lease and without stopAndWait', async () => {
    const h = harness();
    h.state.session = true;
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(0);
    h.state.session = false;
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(1);
    h.state.session = true;
    h.door.calls[0]!.output(window4([0.5, 0.5, 0, 0]));
    expect(h.published).toEqual([]);
  });

  it('a selector that moved the PRIMARY to another card: the next hold replaces the helper', async () => {
    const h = harness({ cards: [BENCH, OTHER], rows: [row('MIC-03', BENCH, 1), row('MIC-07', OTHER, 1)], inputs: [{ deviceId: 'MIC-03', role: 'PRIMARY' }] });
    h.meters.hold('OPR-001');
    await settle();
    h.state.inputs = [{ deviceId: 'MIC-07', role: 'PRIMARY' }];
    h.meters.hold('OPR-001');
    await settle();
    expect(h.door.calls).toHaveLength(2);
    expect(h.door.calls[0]?.alive()).toBe(false);
    expect(h.door.live().map((call) => call.options.args[call.options.args.indexOf('-i') + 1])).toEqual(['dems_2_0']);
  });

  it('close ends every lease and every helper for good', async () => {
    const h = harness();
    h.meters.hold('OPR-001');
    await settle();
    await h.meters.close();
    expect(h.door.live()).toHaveLength(0);
    h.meters.hold('OPR-001');
    h.meters.resume();
    await settle();
    expect(h.door.calls).toHaveLength(1);
  });
});

describe('never writes a file but the configuration, never records', () => {
  it('the only write is the configuration; no argument names a pipe of a session or a file', async () => {
    const h = harness();
    h.meters.hold('OPR-001');
    await settle();
    expect(h.state.writes.map((write) => write.path)).toEqual([`${RUN_DIR}/alsa/dems-alsa.conf`]);
    const args = h.door.calls[0]!.options.args;
    expect(args.slice(1).filter((arg) => arg.startsWith('/') || arg.endsWith('.pcm') || arg === '-y')).toEqual([]);
    expect(args.at(-1)).toBe('pipe:1');
  });
});
