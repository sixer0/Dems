// The production microphone adapter (task 4 blueprint row 67, WP-08; design addendum 4.2, 6.3
// T-1 and T-3; security addendum AD-07 (2) (4), AD-09 (3); review P12-F13).
//
// THE DOUBLES. No Linux host and no sound card exist here; every external is handed in.
//   - THE LISTING is the real parser (`createCardEnumerator`) over fixed texts in the forms of a
//     Linux host; every name in them is synthetic. A test changes the texts to plug a card in at
//     another index, take it away or put another card in its place.
//   - THE CONFIGURATION WRITER is the real one, below a temporary directory.
//   - THE PIPE is a real named pipe: the system program that makes one runs through the real
//     production door.
//   - T-1 (blocks 1 to 6): THE GUARD is played from a script by a door that starts nothing. What
//     this proves is the adapter: what it refuses before anything is started, the exact argument
//     vector, the order of a stop.
//   - Block 7 (review P12-F13): REAL PROCESSES through the real production door. The guard is a
//     stand-in program that ends its child when its own input ends; the helper is a stand-in that
//     PARSES the argument vector option by option (an option it does not know ends it), looks its
//     device up in the generated configuration as the sound library would, generates a
//     multi-channel source, selects the channel the vector names and writes 32-bit float into the
//     pipe. The test reads the pipe back and compares it sample by sample.
// NOT proven here: that the pinned helper accepts the vector for a sound card, the shared capture,
// the card itself (hardware checks 9A/H-07, 9A/H-08), and the BUILT guard of row 23 (row 69).
import { closeSync, constants, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { relativeImports } from '../../../../../test/static/imports';
import { WORKSPACE, codeOnly, isProductionSource, readTree } from '../../../../../test/static/scan';
import { createSystemTimers } from '../../../timers';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../../errors';
import { CaptureAdapterKind, CaptureOperation } from '../../kinds';
import { manualTimers, trustedInspector, type ManualTimers } from '../../local/__tests__/mic-support';
import { inspectProgram, type ProgramFacts } from '../../local/process-door';
import { MIC_TRANSPORTS } from '../../mic-transport';
import { ProductionDoorError, ProductionDoorRefusal, startProductionProcess, type ProductionDoor, type ProductionExit, type ProductionProcess, type ProductionProcessOptions } from '../../production-door';
import { createCaptureDeviceRegistry } from '../../registry';
import { AUDIO_INPUT_BEYOND_CARD, AudioInputBeyondCardError, AudioInputErrorCode, type CaptureDeviceEntry } from '../../types';
import { createAlsaConfigWriter } from '../alsa-config-writer';
import { createCardEnumerator, type CardEnumerator, type CardListingSource } from '../card-listing';
import {
  USB_AUDIO_LIMITS,
  UsbAudioError,
  UsbAudioNoticeCode,
  UsbAudioRefusal,
  createUsbAudioProductionAdapter,
  guardedArguments,
  identifyRegisteredCard,
  isRegisteredAudioInput,
  type RegisteredAudioInput,
  type UsbAudioNotice,
  type UsbAudioProductionAdapter,
  type UsbAudioProductionOptions,
  type UsbAudioStream,
} from '../usb-audio-production';

// ── The host: fixed texts in the forms of a Linux host ────────────────────────────────────────

interface FixtureCard {
  readonly index: number;
  /** The kernel's short name. */
  readonly id: string;
  readonly product: string;
  /** Left out: a card that is not USB. */
  readonly usbId?: string;
  readonly port?: string;
  /** The serial the USB device states (task 4 row 200). Left out: it states none. */
  readonly serial?: string;
  readonly channels: number;
  readonly format?: string;
  readonly rates?: string;
  readonly device?: number;
  /** A card that is not USB and has no hardware parameter dump: its channel count is a guess. */
  readonly noDump?: boolean;
}

interface Host {
  cards: FixtureCard[];
  readonly enumerator: CardEnumerator;
  /** How often the list of capture hardware was asked for. */
  lists(): number;
  failing: boolean;
}

function hostOf(cards: FixtureCard[]): Host {
  let lists = 0;
  const host: Host = { cards, enumerator: undefined as unknown as CardEnumerator, lists: () => lists, failing: false };
  const at = (cardIndex: number): FixtureCard | undefined => host.cards.find((card) => card.index === cardIndex);
  const source: CardListingSource = {
    async captureDevices() {
      lists += 1;
      if (host.failing) throw Object.assign(new Error('the listing program could not be run'), { code: 'EACCES' });
      return `**** List of CAPTURE Hardware Devices ****\n${host.cards.map((card) => `card ${card.index}: ${card.id} [${card.product}], device ${card.device ?? 0}: USB Audio [USB Audio]\n  Subdevices: 1/1\n  Subdevice #0: subdevice #0\n`).join('')}`;
    },
    async presentCards() {
      return host.cards.map((card) => `${String(card.index).padStart(2)} [${card.id.padEnd(15)}]: USB-Audio - ${card.product}\n                      ${card.product}\n`).join('');
    },
    async usbId(cardIndex) {
      const card = at(cardIndex);
      return card?.usbId === undefined ? null : `${card.usbId}\n`;
    },
    async usbSerial(cardIndex) {
      const card = at(cardIndex);
      return card?.serial === undefined ? null : `${card.serial}\n`;
    },
    async stream(cardIndex) {
      const card = at(cardIndex);
      if (card?.usbId === undefined) return null;
      return `${card.product} at usb-${card.port ?? DEFAULT_PORT}, high speed : USB Audio\n\nCapture:\n  Status: Stop\n  Interface 1\n    Altset 1\n    Format: ${card.format ?? 'S24_3LE'}\n    Channels: ${card.channels}\n    Endpoint: 0x81 (1 IN) (ASYNC)\n    Rates: ${card.rates ?? '44100, 48000'}\n    Bits: 24\n\n`;
    },
    async hwParams(cardIndex) {
      const card = at(cardIndex);
      if (card === undefined || card.noDump === true) return null;
      return `HW Params of device "hw:${cardIndex},0":\n--------------------\nFORMAT:  S16_LE S32_LE\nCHANNELS: ${card.channels}\nRATE: [44100 192000]\n--------------------\n`;
    },
  };
  (host as { enumerator: CardEnumerator }).enumerator = createCardEnumerator(source);
  return host;
}

const DUO: FixtureCard = { index: 1, id: 'Duo', product: 'DEMS Test Duo', usbId: '1a2b:0001', port: '0000:00:14.0-2', channels: 2 };
const OCTO: FixtureCard = { index: 2, id: 'Octo', product: 'DEMS Test Octo', usbId: '1a2b:0008', port: '0000:00:14.0-3.1', channels: 8, format: 'S32_LE', rates: '44100, 48000, 96000' };
const OTHER: FixtureCard = { index: 3, id: 'Codec', product: 'DEMS Other Codec', usbId: '3c4d:2902', port: '0000:00:14.0-4', channels: 2, format: 'S16_LE' };

/** The port path the fixture host states for a USB card that names none. */
const DEFAULT_PORT = '0000:00:14.0-2';
/**
 * The stored row of an input registered on `card`: since rows 199 / 200 it holds the serial the
 * card stated (null: none) and the port path it sat on, as the registration stores them.
 */
const row = (deviceId: string, card: FixtureCard, inputNumber: number, patch: Partial<RegisteredAudioInput> = {}): RegisteredAudioInput => ({
  deviceId,
  usbId: card.usbId ?? null,
  usbSerial: card.usbId === undefined ? null : (card.serial ?? null),
  usbPort: card.usbId === undefined ? null : (card.port ?? DEFAULT_PORT),
  cardId: card.id,
  cardDevice: card.device ?? 0,
  inputNumber,
  nativeChannels: card.channels,
  ...patch,
});

const entryOf = (id: string): CaptureDeviceEntry => ({ id, deviceClass: 'MIC', label: id, capabilities: ['AUDIO'], profiles: [] });

// ── The doors ─────────────────────────────────────────────────────────────────────────────────

const PIPE_MAKER = `/usr/bin/${['mk', 'fifo'].join('')}`;
const HELPER = '/opt/dems/bin/ffmpeg';
const GUARD = '/opt/dems/bin/capture-guard';
const exitOf = (patch: Partial<ProductionExit> = {}): ProductionExit => ({ exitCode: 0, signal: null, spawnFailed: false, diagnostics: '', output: '', ...patch });
/** One block of the helper's progress report after its first bytes. */
const PROGRESS = 'total_size=4096\nout_time_us=21333\nprogress=continue\n';
/** The real door with the core-file limit stated: the pipe maker and the stand-in programs run through it. */
const realDoor: ProductionDoor = (options) => startProductionProcess({ ...options, coreFileLimit: () => 0 });

interface Script {
  /** It ends by itself right away with this exit. */
  readonly ends?: Partial<ProductionExit>;
  /** The door refuses the start with this code: `started` rejects and no process exists. */
  readonly refuses?: ProductionDoorRefusal;
  /** What it writes to standard output right after its start. */
  readonly reports?: string;
  /** It does not end when its input ends (a guard that hangs). */
  readonly ignoresInputEnd?: boolean;
  readonly ignoresTerm?: boolean;
}

interface Played extends ProductionProcess {
  /** What was done to it, in order: `END_INPUT`, `SIGTERM`, `SIGKILL`. */
  readonly orders: string[];
  /** Ends it on its own, as a crash would. */
  endNow(exit?: Partial<ProductionExit>): void;
}

interface DoorCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: ProductionProcessOptions['env'];
  readonly message: ProductionProcessOptions['message'];
}

interface ScriptedDoor {
  readonly door: ProductionDoor;
  /** Every start that was asked for, the pipe maker included. */
  readonly calls: DoorCall[];
  /** The guards only, in order. */
  readonly guards: Played[];
  guardCalls(): DoorCall[];
}

function scriptedDoor(script: (call: DoorCall, index: number) => Script = () => ({ reports: PROGRESS })): ScriptedDoor {
  const calls: DoorCall[] = [];
  const guards: Played[] = [];
  const door: ProductionDoor = (options) => {
    const call: DoorCall = { command: options.command, args: [...options.args], env: options.env, message: options.message };
    calls.push(call);
    if (options.command === PIPE_MAKER) return realDoor(options);
    const played = script(call, guards.length);
    let over = false;
    let finish: (exit: ProductionExit) => void = () => {};
    const ended = new Promise<ProductionExit>((resolve) => {
      finish = (exit) => {
        if (over) return;
        over = true;
        resolve(exit);
      };
    });
    const orders: string[] = [];
    const started = played.refuses === undefined ? Promise.resolve() : Promise.reject(new ProductionDoorError(played.refuses));
    started.catch(() => {});
    if (played.refuses !== undefined) finish(exitOf({ exitCode: null, spawnFailed: true }));
    else if (played.ends !== undefined) queueMicrotask(() => finish(exitOf(played.ends)));
    else if (played.reports !== undefined) queueMicrotask(() => options.onOutput?.(Buffer.from(played.reports ?? '')));
    const process: Played = {
      pid: played.refuses === undefined ? 7000 + guards.length : null,
      started,
      ended,
      orders,
      alive: () => !over,
      endInput() {
        orders.push('END_INPUT');
        if (played.ignoresInputEnd !== true) finish(exitOf());
      },
      kill(signal) {
        orders.push(signal);
        if (signal === 'SIGTERM' && played.ignoresTerm === true) return;
        finish(exitOf({ exitCode: null, signal }));
      },
      endNow: (exit = { exitCode: 1 }) => finish(exitOf(exit)),
    };
    guards.push(process);
    return process;
  };
  return { door, calls, guards, guardCalls: () => calls.filter((call) => call.command !== PIPE_MAKER) };
}

// ── The rig ───────────────────────────────────────────────────────────────────────────────────

const root = realpathSync(mkdtempSync(join(tmpdir(), 'dems-row67-')));
afterAll(() => rmSync(root, { recursive: true, force: true }));
let cases = 0;
const uid = process.getuid?.() ?? 501;

interface Rig {
  readonly host: Host;
  readonly rows: Map<string, RegisteredAudioInput>;
  readonly door: ScriptedDoor;
  readonly timers: ManualTimers;
  readonly runDir: string;
  readonly configPath: string;
  readonly notices: UsbAudioNotice[];
  readonly lost: [string, UsbAudioError][];
  readonly adapter: UsbAudioProductionAdapter;
  configText(): string;
}

function rig(cards: FixtureCard[], rows: RegisteredAudioInput[], script?: (call: DoorCall, index: number) => Script, over: Partial<UsbAudioProductionOptions> = {}): Rig {
  const host = hostOf([...cards]);
  const stored = new Map(rows.map((entry) => [entry.deviceId, entry]));
  const door = scriptedDoor(script);
  const timers = manualTimers();
  const runDir = `${root}/case-${String((cases += 1))}/run/capture`;
  const notices: UsbAudioNotice[] = [];
  const lost: [string, UsbAudioError][] = [];
  const adapter = createUsbAudioProductionAdapter({
    devices: rows.map((entry) => entryOf(entry.deviceId)),
    registered: async (deviceId) => stored.get(deviceId) ?? null,
    cards: host.enumerator,
    configWriter: createAlsaConfigWriter(runDir),
    helperProgram: HELPER,
    guardProgram: GUARD,
    runDir,
    timers,
    door: door.door,
    inspect: trustedInspector(uid),
    onNotice: (notice) => notices.push(notice),
    onSourceLost: (deviceId, error) => lost.push([deviceId, error]),
    ...over,
  });
  const configPath = `${runDir}/alsa/dems-alsa.conf`;
  return { host, rows: stored, door, timers, runDir, configPath, notices, lost, adapter, configText: () => readFileSync(configPath, 'utf8') };
}

const target = (sessionId = 'SES-67', signal: AbortSignal = new AbortController().signal): { sessionId: string; signal: AbortSignal } => ({ sessionId, signal });

async function until(condition: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 600 && !condition(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  if (!condition()) throw new Error(`timed out waiting for ${label}`);
}

/** Starts the helper and, if it is still alive, lets the settle time pass. Resolves with the error, or null when the start worked. */
async function startAndSettle(stream: UsbAudioStream, timers: ManualTimers, signal?: AbortSignal): Promise<unknown> {
  const outcome = stream.start(signal).then(
    () => null,
    (error: unknown) => error,
  );
  await Promise.race([until(() => timers.pending().includes(USB_AUDIO_LIMITS.settleMs), 'the settle timer'), outcome]);
  timers.fire(USB_AUDIO_LIMITS.settleMs);
  return outcome;
}

async function refusalOf(promise: Promise<unknown>): Promise<UsbAudioError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(UsbAudioError);
    return error as UsbAudioError;
  }
  throw new Error('expected a named refusal');
}

/** The whole vector of the helper for one input, written out as text: nothing of it is computed by the table under test. */
const vector = (channels: number, device: string, selection: string, pipe: string): string[] => [
  '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning',
  '-progress', 'pipe:1',
  '-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-ch_layout', `${String(channels)}C`, '-sample_rate', '48000', '-i', device,
  '-af', selection,
  '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-y',
  pipe,
];

const sharedBlock = (card: number, channels: number, format: string, key: number): string =>
  `pcm.dems_${card}_0_shared {\n  type dsnoop\n  ipc_key ${key}\n  ipc_perm 0660\n  slave { pcm "hw:CARD=${card},DEV=0" channels ${channels} rate 48000 format ${format} period_size 1024 buffer_size 8192 }\n}\npcm.dems_${card}_0 { type plug slave.pcm "dems_${card}_0_shared" }\n`;
const INCLUDE = '</usr/share/alsa/alsa.conf>\n';

// ── 1. The open: fresh listing, the card by its stored identity, arguments from integers ──────

describe('open: the registered input, found in a fresh listing, opened with integers only', () => {
  it('input 2 of a 2-input card: the exact vector, the pipe of the transport, the configuration of the card, and no helper yet', async () => {
    const r = rig([DUO], [row('MIC-01', DUO, 2)]);
    const stream = await r.adapter.open('MIC-01', target());
    const pipe = `${r.runDir}/SES-67/MIC-01.pcm`;
    expect(stream.input).toEqual({ kind: 'PCM_FIFO', path: pipe });
    expect(stream.transport).toBe(MIC_TRANSPORTS.PCM_FIFO);
    expect(stream.transport).toMatchObject({ sampleFormat: 'F32LE', sampleRateHz: 48_000, channels: 1 });
    expect([...stream.helperArguments]).toEqual(vector(2, 'dems_1_0', 'pan=mono|c0=c1', pipe));
    expect(r.configText()).toBe(INCLUDE + sharedBlock(1, 2, 'S24_3LE', 52_032));
    // `open` prepared the pipe and started nothing but the program that makes it; one listing was read.
    expect(r.door.guardCalls()).toEqual([]);
    expect(r.door.calls.map((call) => [call.command, call.args, call.env, call.message])).toEqual([[PIPE_MAKER, ['-m', '600', pipe], {}, null]]);
    expect(r.host.lists()).toBe(1);
    expect(stream.started()).toBe(false);
    expect(r.adapter.openSources()).toEqual(['MIC-01']);
    await stream.close();
    expect(existsSync(pipe)).toBe(false);
  });

  it('input 3 of an 8-input interface: all 8 channels opened, channel 2 selected', async () => {
    const r = rig([DUO, OCTO], [row('MIC-02', OCTO, 3)]);
    const stream = await r.adapter.open('MIC-02', target());
    expect([...stream.helperArguments]).toEqual(vector(8, 'dems_2_0', 'pan=mono|c0=c2', `${r.runDir}/SES-67/MIC-02.pcm`));
    expect(r.configText()).toBe(INCLUDE + sharedBlock(2, 8, 'S32_LE', 52_064));
    expect(stream.card).toMatchObject({ cardIndex: 2, deviceIndex: 0, channelCount: 8, inputNumber: 3, rateHz: 48_000, nativeFormat: 'S32_LE', sampleBits: 24 });
    await stream.close();
  });

  it('the card came back at another index: found by its USB id, the NEW index used; the card at the old index is not taken for it', async () => {
    const r = rig([DUO, OCTO], [row('MIC-02', OCTO, 3)]);
    // Re-plugged in another order: the interface is card 4 now, and a different card sits at index 2.
    r.host.cards = [DUO, { ...OTHER, index: 2 }, { ...OCTO, index: 4 }];
    const stream = await r.adapter.open('MIC-02', target());
    expect([...stream.helperArguments]).toEqual(vector(8, 'dems_4_0', 'pan=mono|c0=c2', `${r.runDir}/SES-67/MIC-02.pcm`));
    expect(r.configText()).toBe(INCLUDE + sharedBlock(4, 8, 'S32_LE', 52_128));
    expect(r.notices).toEqual([]);
    await stream.close();
    // Two opens are two listings: nothing of the first is kept.
    r.host.cards = [{ ...OCTO, index: 0 }];
    const again = await r.adapter.open('MIC-02', target());
    expect(again.helperArguments).toContain('dems_0_0');
    expect(r.host.lists()).toBe(2);
    await again.close();
  });

  it('two inputs of one card by two handles: ONE configuration with one entry for the card, two helpers, each with its own selection and pipe', async () => {
    const r = rig([DUO, OCTO], [row('MIC-01', OCTO, 1), row('MIC-02', OCTO, 3)]);
    const first = await r.adapter.open('MIC-01', target());
    const second = await r.adapter.open('MIC-02', target());
    expect(r.configText()).toBe(INCLUDE + sharedBlock(2, 8, 'S32_LE', 52_064));
    expect(r.configText().match(/type dsnoop/g)).toHaveLength(1);
    // Both are launched in the same turn, as the session start does.
    const outcomes = Promise.all([first.start().then(() => null), second.start().then(() => null)]);
    await until(() => r.timers.pending().filter((delay) => delay === USB_AUDIO_LIMITS.settleMs).length === 2, 'both settle timers');
    r.timers.fire(USB_AUDIO_LIMITS.settleMs);
    r.timers.fire(USB_AUDIO_LIMITS.settleMs);
    expect(await outcomes).toEqual([null, null]);
    const env = { ALSA_CONFIG_PATH: r.configPath };
    expect(r.door.guardCalls().map((call) => [call.command, call.env, call.message, call.args[0], call.args.includes('dems_2_0')])).toEqual([
      [GUARD, env, null, HELPER, true],
      [GUARD, env, null, HELPER, true],
    ]);
    expect(r.door.guardCalls().map((call) => call.args.filter((arg) => arg.includes('|') || arg.endsWith('.pcm'))).sort()).toEqual([
      ['pan=mono|c0=c0', `${r.runDir}/SES-67/MIC-01.pcm`],
      ['pan=mono|c0=c2', `${r.runDir}/SES-67/MIC-02.pcm`],
    ]);
    expect(r.adapter.livePids().size).toBe(2);
    await r.adapter.closeAll();
    expect(r.adapter.openSources()).toEqual([]);
    expect(r.adapter.livePids().size).toBe(0);
  });

  it('inputs of two cards: one configuration with both cards, by card index', async () => {
    const r = rig([DUO, OCTO], [row('MIC-01', DUO, 1), row('MIC-02', OCTO, 8)]);
    const second = await r.adapter.open('MIC-02', target());
    const first = await r.adapter.open('MIC-01', target());
    expect(r.configText()).toBe(INCLUDE + sharedBlock(1, 2, 'S24_3LE', 52_032) + sharedBlock(2, 8, 'S32_LE', 52_064));
    expect(first.helperArguments).toContain('pan=mono|c0=c0');
    expect(second.helperArguments).toContain('pan=mono|c0=c7');
    await r.adapter.closeAll();
  });
});

// ── 2. The refusals of the open: nothing is made and nothing is started ───────────────────────

describe('open: what is refused, by name, before a pipe or a helper exists', () => {
  const nothingMade = (r: Rig): void => {
    expect(r.door.calls).toEqual([]);
    expect(r.adapter.openSources()).toEqual([]);
    expect(existsSync(`${r.runDir}/SES-67`)).toBe(false);
  };

  it('the card is absent: AUDIO_CARD_ABSENT, also while another USB card is connected - no other card is taken', async () => {
    const r = rig([DUO, OTHER], [row('MIC-02', OCTO, 3)]);
    const refused = await refusalOf(r.adapter.open('MIC-02', target()));
    expect([refused.code, refused.wireCode, refused.deviceId]).toEqual(['AUDIO_CARD_ABSENT', 'DEVICE_NOT_FOUND', 'MIC-02']);
    nothingMade(r);
    r.host.cards = [];
    expect((await refusalOf(r.adapter.open('MIC-02', target()))).code).toBe(UsbAudioRefusal.CARD_ABSENT);
  });

  it('ANOTHER card sits where it was (the same kernel name and index, another USB id): AUDIO_CARD_CHANGED, never recorded from', async () => {
    const r = rig([{ ...OTHER, index: OCTO.index, id: OCTO.id, channels: 8 }], [row('MIC-02', OCTO, 3)]);
    const refused = await refusalOf(r.adapter.open('MIC-02', target()));
    expect([refused.code, refused.wireCode]).toEqual(['AUDIO_CARD_CHANGED', 'DEVICE_NOT_FOUND']);
    nothingMade(r);
    // A card that is not USB under the name of a registered USB card, and a USB card under the name of a registered card that is not USB.
    const onboard = rig([{ index: 0, id: 'Octo', product: 'Onboard', channels: 8 }], [row('MIC-02', OCTO, 3)]);
    expect((await refusalOf(onboard.adapter.open('MIC-02', target()))).code).toBe(UsbAudioRefusal.CARD_CHANGED);
    const swapped = rig([{ ...DUO, id: 'PCH' }], [row('MIC-01', { index: 0, id: 'PCH', product: 'Onboard', channels: 2 }, 1)]);
    expect((await refusalOf(swapped.adapter.open('MIC-01', target()))).code).toBe(UsbAudioRefusal.CARD_CHANGED);
  });

  it('the selected input is beyond the card: AUDIO_INPUT_BEYOND_CARD with the registry id, and no value in the text', async () => {
    // Registered as input 3 of 8; the card with that identity shows 2 channels now.
    const r = rig([{ ...OCTO, channels: 2 }], [row('MIC-02', OCTO, 3)]);
    const refused: unknown = await r.adapter.open('MIC-02', target()).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(AudioInputBeyondCardError);
    expect([(refused as AudioInputBeyondCardError).code, (refused as AudioInputBeyondCardError).deviceId]).toEqual([AUDIO_INPUT_BEYOND_CARD, 'MIC-02']);
    expect((refused as Error).message).toBe('the sound card has no such input');
    nothingMade(r);
  });

  // TURNED BY ROW 200 (was: "two connected cards carry the stored USB id: AUDIO_CARD_AMBIGUOUS").
  // Two units of one model are told apart by the stored port path (or serial): a room with two
  // identical interfaces can record. AMBIGUOUS is left for two units that state the stored serial
  // where the port names neither.
  it('two connected cards carry the stored USB id: the one ON THE STORED PORT is opened; two that state the stored serial with no port to tell them apart: AUDIO_CARD_AMBIGUOUS; the fixed word of an unreadable id: AUDIO_CARD_UNIDENTIFIED', async () => {
    const twin = { ...DUO, index: 5, id: 'Duo_1', port: '0000:00:14.0-7' };
    const twins = rig([DUO, twin], [row('MIC-01', DUO, 1), row('MIC-02', twin, 1)]);
    const first = await twins.adapter.open('MIC-01', target());
    const second = await twins.adapter.open('MIC-02', target());
    expect([first.card.cardIndex, first.card.usbPort, second.card.cardIndex, second.card.usbPort]).toEqual([1, DUO.port, 5, '0000:00:14.0-7']);
    await first.close();
    await second.close();
    const shared = rig([{ ...DUO, serial: 'SN-SAME' }, { ...twin, serial: 'SN-SAME' }], [row('MIC-01', { ...DUO, serial: 'SN-SAME' }, 1, { usbPort: null })]);
    const ambiguous = await refusalOf(shared.adapter.open('MIC-01', target()));
    expect([ambiguous.code, ambiguous.detail, ambiguous.wireCode]).toEqual(['AUDIO_CARD_AMBIGUOUS', 'SERIAL_SHARED', 'DEVICE_NOT_FOUND']);
    nothingMade(shared);
    const unread = rig([{ ...DUO, usbId: 'not an id' }], [row('MIC-01', DUO, 1, { usbId: '0000:0000' })]);
    expect((await refusalOf(unread.adapter.open('MIC-01', target()))).code).toBe(UsbAudioRefusal.CARD_UNIDENTIFIED);
  });

  it('a guessed channel count, a card without the rate of the transport, a failed listing, no stored row, a stored row of another shape', async () => {
    const guessed = rig([{ index: 0, id: 'PCH', product: 'Onboard', channels: 2, noDump: true }], [row('MIC-01', { index: 0, id: 'PCH', product: 'Onboard', channels: 2 }, 1)]);
    expect((await refusalOf(guessed.adapter.open('MIC-01', target()))).code).toBe(UsbAudioRefusal.CARD_FACTS_UNKNOWN);
    const slow = rig([{ ...DUO, rates: '44100' }], [row('MIC-01', DUO, 1)]);
    expect((await refusalOf(slow.adapter.open('MIC-01', target()))).code).toBe(UsbAudioRefusal.CARD_RATE_UNSUPPORTED);
    const failing = rig([DUO], [row('MIC-01', DUO, 1)]);
    failing.host.failing = true;
    const listing = await refusalOf(failing.adapter.open('MIC-01', target()));
    expect([listing.code, listing.detail, listing.wireCode]).toEqual(['AUDIO_CARD_LISTING_FAILED', 'EACCES', 'OPEN_FAILED']);
    expect(listing.message).toBe('the sound cards could not be listed');
    const unregistered = rig([DUO], [row('MIC-01', DUO, 1)]);
    unregistered.rows.delete('MIC-01');
    expect((await refusalOf(unregistered.adapter.open('MIC-01', target()))).code).toBe(UsbAudioRefusal.INPUT_NOT_REGISTERED);
    nothingMade(unregistered);
    for (const patch of [{ cardId: 'hw:CARD=Duo' }, { usbId: '1A2B:0001' }, { inputNumber: 0 }, { inputNumber: 1.5 }, { cardDevice: 32 }, { inputNumber: 3, nativeChannels: 2 }, { deviceId: 'CAM-01' }, { usbSerial: 'SN 01' }, { usbSerial: '' }, { usbPort: '../x' }, { usbPort: 'P'.repeat(65) }, { usbSerial: 7 as unknown as string }] as const) {
      expect(isRegisteredAudioInput(row('MIC-01', DUO, 1, patch)), JSON.stringify(patch)).toBe(false);
    }
    const bent = rig([DUO], [row('MIC-01', DUO, 1, { cardId: 'Duo;x' })]);
    expect((await refusalOf(bent.adapter.open('MIC-01', target()))).code).toBe(UsbAudioRefusal.INPUT_NOT_REGISTERED);
    expect(bent.host.lists()).toBe(0);
  });

  it('a program the path rule refuses, an unknown device, a second open of one input, an aborted call', async () => {
    const facts = trustedInspector(uid);
    const refusing = rig([DUO], [row('MIC-01', DUO, 1)], undefined, { inspect: (path): ProgramFacts => (path === GUARD ? { ...facts(), file: { ownerUid: 0, mode: 0o777 } } : facts()) });
    const program = await refusalOf(refusing.adapter.open('MIC-01', target()));
    expect([program.code, program.detail]).toEqual(['AUDIO_PROGRAM_REFUSED', 'GUARD_FILE_WRITABLE']);
    expect(refusing.host.lists()).toBe(0);
    nothingMade(refusing);

    const r = rig([DUO], [row('MIC-01', DUO, 1)]);
    await expect(r.adapter.open('MIC-09', target())).rejects.toMatchObject({ code: CaptureAdapterRefusal.DEVICE_UNKNOWN });
    const stream = await r.adapter.open('MIC-01', target());
    const second = await refusalOf(r.adapter.open('MIC-01', target('SES-68')));
    expect([second.code, second.wireCode]).toEqual(['AUDIO_INPUT_ALREADY_OPEN', 'DEVICE_BUSY']);
    await stream.close();
    const gone = new AbortController();
    gone.abort();
    expect((await refusalOf(r.adapter.open('MIC-01', target('SES-67', gone.signal)))).code).toBe(UsbAudioRefusal.ABORTED);
    expect(r.adapter.openSources()).toEqual([]);
  });

  it('what is told and not refused: a card found under another kernel name, and a channel count that differs from the stored one', async () => {
    const r = rig([{ ...OCTO, id: 'Octo_1', channels: 6 }], [row('MIC-02', OCTO, 3)]);
    const stream = await r.adapter.open('MIC-02', target());
    expect(r.notices).toEqual([
      { code: UsbAudioNoticeCode.CARD_RENAMED, deviceId: 'MIC-02' },
      { code: UsbAudioNoticeCode.CARD_CHANNELS_DIFFER, deviceId: 'MIC-02' },
    ]);
    // The LIVE count opens the card.
    expect(stream.helperArguments.slice(stream.helperArguments.indexOf('-ch_layout'), stream.helperArguments.indexOf('-ch_layout') + 2)).toEqual(['-ch_layout', '6C']);
    await stream.close();
  });
});

// ── 2b. Task 4 row 200: the stored row is matched by serial, else by port path ───────────────
//
// T-1 WITH THE DOOR DOUBLE: the guard is played by a door that starts nothing, so "0 helper
// starts" is the count of what the door was asked. THE HOST is the fixed listing texts above; a
// swap, a re-plug and a move are a change of those texts. No sound card, never this Mac's
// microphone. The incident this reproduces: input-av's handover recorded a sound card silently
// swapped for another of the same model.
describe('row 200: at open and again at start the stored row is matched to a live card by serial, else by port path', () => {
  const ELSEWHERE = '0000:00:14.0-7';
  const nothingStarted = (r: Rig): void => {
    expect(r.door.calls).toEqual([]);
    expect(r.door.guards).toEqual([]);
    expect(r.adapter.openSources()).toEqual([]);
    expect(existsSync(`${r.runDir}/SES-67`)).toBe(false);
  };

  it('A SWAPPED SAME-MODEL CARD ON ANOTHER PORT is refused by AUDIO_CARD_CHANGED with 0 helper starts, no pipe and no configuration - at the open, at the pre-check and in the enumeration', async () => {
    // Registered: the Duo on its port, no serial. Connected now: ANOTHER unit of the model - the same kernel name, index, USB id and product - on another port.
    const r = rig([{ ...DUO, port: ELSEWHERE }], [row('MIC-01', DUO, 1)]);
    const refused = await refusalOf(r.adapter.open('MIC-01', target()));
    expect([refused.code, refused.detail, refused.wireCode, refused.deviceId]).toEqual(['AUDIO_CARD_CHANGED', 'PORT_DIFFERS', 'DEVICE_NOT_FOUND', 'MIC-01']);
    expect(refused.message).toBe('another sound card sits where the registered one was');
    nothingStarted(r);
    expect(existsSync(r.configPath)).toBe(false);
    const checked = await r.adapter.precheck('MIC-01');
    expect(checked).toBeInstanceOf(UsbAudioError);
    expect((checked as UsbAudioError).code).toBe(UsbAudioRefusal.CARD_CHANGED);
    expect(await r.adapter.enumerate()).toEqual([{ inputId: 'MIC-01', present: false, errorCode: AudioInputErrorCode.DEVICE_NOT_FOUND }]);
    expect(r.adapter.sourceFacts('MIC-01')).toBeNull();
    nothingStarted(r);
    // No serial, port or USB id is in the refusal.
    for (const text of [DUO.port ?? '', ELSEWHERE, DUO.usbId ?? '', DUO.product]) expect(JSON.stringify({ ...refused, message: refused.message })).not.toContain(text);
  });

  it('THE SAME CARD AFTER A RE-PLUG ON ITS PORT opens - at another card index too - and the helper starts once; CONTROL for the case above', async () => {
    const r = rig([DUO], [row('MIC-01', DUO, 1)]);
    // Unplugged: absent, by its own name.
    r.host.cards = [];
    expect((await refusalOf(r.adapter.open('MIC-01', target()))).code).toBe(UsbAudioRefusal.CARD_ABSENT);
    // Plugged back into the same socket; the kernel gave it another index.
    r.host.cards = [{ ...DUO, index: 3 }];
    const stream = await r.adapter.open('MIC-01', target());
    expect([stream.card.cardIndex, stream.card.usbPort, stream.card.usbSerial]).toEqual([3, DUO.port, null]);
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    expect(r.door.guards).toHaveLength(1);
    expect(r.notices).toEqual([]);
    await stream.close();
  });

  it('a card WITH a serial: found on ANOTHER port by its serial (it was moved); another unit - another serial, on the stored port or elsewhere - is refused with 0 helper starts', async () => {
    const mine = { ...OCTO, serial: 'SN-MINE-0001' };
    const moved = rig([{ ...mine, port: ELSEWHERE, index: 6 }], [row('MIC-02', mine, 3)]);
    const stream = await moved.adapter.open('MIC-02', target());
    // The source facts state the serial and the port ACTUALLY USED: the live port, not the stored one.
    expect(moved.adapter.sourceFacts('MIC-02')).toMatchObject({ usbSerial: 'SN-MINE-0001', usbPort: ELSEWHERE, usbId: OCTO.usbId, cardId: 'Octo', inputNumber: 3 });
    expect(moved.rows.get('MIC-02')?.usbPort).toBe(OCTO.port);
    await stream.close();
    for (const [name, other] of [
      ['another serial on the STORED port', { ...OCTO, serial: 'SN-OTHER-0002' }],
      ['another serial on another port', { ...OCTO, serial: 'SN-OTHER-0002', port: ELSEWHERE }],
      ['no serial at all, on the stored port', OCTO],
    ] as const) {
      const r = rig([other], [row('MIC-02', mine, 3)]);
      const refused = await refusalOf(r.adapter.open('MIC-02', target()));
      expect([refused.code, refused.detail], name).toEqual(['AUDIO_CARD_CHANGED', 'SERIAL_DIFFERS']);
      nothingStarted(r);
    }
    // Both units connected: the registered one is opened, whatever sits on its old port.
    const both = rig([{ ...OCTO, serial: 'SN-OTHER-0002' }, { ...mine, index: 6, id: 'Octo_1', port: ELSEWHERE }], [row('MIC-02', mine, 3)]);
    const found = await both.adapter.open('MIC-02', target());
    expect([found.card.cardIndex, found.card.usbSerial, found.card.usbPort]).toEqual([6, 'SN-MINE-0001', ELSEWHERE]);
    expect(both.notices).toEqual([{ code: UsbAudioNoticeCode.CARD_RENAMED, deviceId: 'MIC-02' }]);
    await found.close();
  });

  it('the cases left open, each refused before anything starts: a serial where none was registered; a stored row with neither serial nor port (registered before the columns existed)', async () => {
    // Registered without a serial; the unit on the stored port states one today.
    const appeared = rig([{ ...DUO, serial: 'SN-NEW-0003' }], [row('MIC-01', DUO, 1)]);
    const first = await refusalOf(appeared.adapter.open('MIC-01', target()));
    expect([first.code, first.detail]).toEqual(['AUDIO_CARD_CHANGED', 'SERIAL_DIFFERS']);
    nothingStarted(appeared);
    // The row as schema set A left it, and the row of a reader that hands neither value over: the USB id alone finds no card.
    for (const patch of [{ usbSerial: null, usbPort: null }, { usbSerial: undefined, usbPort: undefined }] as const) {
      const before = rig([DUO], [row('MIC-01', DUO, 1, patch)]);
      const refused = await refusalOf(before.adapter.open('MIC-01', target()));
      expect([refused.code, refused.detail, refused.wireCode]).toEqual(['AUDIO_CARD_UNIDENTIFIED', 'IDENTITY_NOT_STORED', 'DEVICE_NOT_FOUND']);
      expect(refused.message).toBe('the registered sound card has no identity to find it by');
      nothingStarted(before);
      // Whatever is connected: also with no card at all it is the identity that is missing.
      before.host.cards = [];
      expect((await refusalOf(before.adapter.open('MIC-01', target()))).code).toBe(UsbAudioRefusal.CARD_UNIDENTIFIED);
    }
    // A card that is not USB has no serial and no port and is found by its kernel name, as before.
    const onboard: FixtureCard = { index: 0, id: 'PCH', product: 'Onboard', channels: 2 };
    const plain = rig([onboard], [row('MIC-01', onboard, 1)]);
    await (await plain.adapter.open('MIC-01', target())).close();
  });

  it('AGAIN AT START: a card swapped between the open and the start is refused before the door is called - 0 helper starts', async () => {
    // Without a serial: the registered unit is taken away and another of the model is plugged elsewhere.
    const r = rig([DUO], [row('MIC-01', DUO, 1)]);
    const stream = await r.adapter.open('MIC-01', target());
    r.host.cards = [{ ...DUO, port: ELSEWHERE }];
    const swapped = await refusalOf(stream.start());
    expect([swapped.code, swapped.detail]).toEqual(['AUDIO_CARD_CHANGED', 'PORT_DIFFERS']);
    expect(r.door.guards).toEqual([]);
    await stream.close();
    // With a serial: another unit in the SAME socket, at the same index, with the same channels - nothing but the serial differs.
    const mine = { ...OCTO, serial: 'SN-MINE-0001' };
    const serialled = rig([mine], [row('MIC-02', mine, 3)]);
    const opened = await serialled.adapter.open('MIC-02', target());
    serialled.host.cards = [{ ...OCTO, serial: 'SN-OTHER-0002' }];
    const other = await refusalOf(opened.start());
    expect([other.code, other.detail]).toEqual(['AUDIO_CARD_CHANGED', 'SERIAL_DIFFERS']);
    expect(serialled.door.guards).toEqual([]);
    await opened.close();
    // The registered unit moved to another socket since the open (same index): it IS the card, but not where the open found it.
    const movedSince = rig([mine], [row('MIC-02', mine, 3)]);
    const handle = await movedSince.adapter.open('MIC-02', target());
    movedSince.host.cards = [{ ...mine, port: ELSEWHERE }];
    expect((await refusalOf(handle.start())).code).toBe(UsbAudioRefusal.CARD_MOVED);
    expect(movedSince.door.guards).toEqual([]);
    await handle.close();
  });

  it('the rule as a function of one listing: the detail word of every refusal, and no card index read', async () => {
    const mine = { ...OCTO, serial: 'SN-A' };
    const stored = row('MIC-02', mine, 3);
    const answer = async (cards: FixtureCard[], against: RegisteredAudioInput = stored): Promise<unknown> => {
      const found = identifyRegisteredCard(await hostOf(cards).enumerator.list(), against);
      return found.ok ? [found.card.cardIndex, found.renamed] : [found.refusal, found.detail ?? null];
    };
    expect(await answer([mine])).toEqual([2, false]);
    expect(await answer([{ ...mine, index: 9, port: ELSEWHERE }])).toEqual([9, false]);
    expect(await answer([{ ...OCTO, serial: 'SN-B' }])).toEqual(['AUDIO_CARD_CHANGED', 'SERIAL_DIFFERS']);
    expect(await answer([DUO])).toEqual(['AUDIO_CARD_ABSENT', null]);
    expect(await answer([{ ...OTHER, index: 2, id: 'Octo', channels: 8 }])).toEqual(['AUDIO_CARD_CHANGED', 'USB_ID_DIFFERS']);
    // Two units state the stored serial: the stored port decides; with the registered port empty, or no port stored, nothing decides.
    const twin = { ...mine, index: 5, id: 'Octo_1', port: ELSEWHERE };
    expect(await answer([mine, twin])).toEqual([2, false]);
    expect(await answer([{ ...mine, port: '0000:00:14.0-9' }, twin])).toEqual(['AUDIO_CARD_AMBIGUOUS', 'SERIAL_SHARED']);
    expect(await answer([mine, twin], { ...stored, usbPort: null })).toEqual(['AUDIO_CARD_AMBIGUOUS', 'SERIAL_SHARED']);
    // No serial stored: the port, and only the port.
    const plain = row('MIC-02', OCTO, 3);
    expect(await answer([OCTO, { ...OCTO, index: 5, id: 'Octo_1', port: ELSEWHERE }], plain)).toEqual([2, false]);
    expect(await answer([{ ...OCTO, index: 5, id: 'Octo_1', port: ELSEWHERE }], plain)).toEqual(['AUDIO_CARD_CHANGED', 'PORT_DIFFERS']);
    expect(await answer([mine], plain)).toEqual(['AUDIO_CARD_CHANGED', 'SERIAL_DIFFERS']);
    expect(await answer([OCTO], { ...plain, usbPort: null })).toEqual(['AUDIO_CARD_UNIDENTIFIED', 'IDENTITY_NOT_STORED']);
  });
});

// ── 3. The match, as a function of one listing ────────────────────────────────────────────────

describe('identifyRegisteredCard: the stored identity, never the card index', () => {
  it('reads no card index: the same cards at any indexes give the same answer', async () => {
    const stored = row('MIC-02', OCTO, 3);
    for (const order of [[DUO, OCTO], [{ ...OCTO, index: 0 }, { ...DUO, index: 7 }], [{ ...OTHER, index: 2 }, { ...OCTO, index: 31 }]]) {
      const found = identifyRegisteredCard(await hostOf(order).enumerator.list(), stored);
      expect(found.ok && [found.card.usbId, found.card.cardId, found.renamed]).toEqual(['1a2b:0008', 'Octo', false]);
    }
    // Another device index of the same card is another capture device: not the registered one.
    const moved = identifyRegisteredCard(await hostOf([{ ...OCTO, device: 1 }]).enumerator.list(), stored);
    expect(moved).toEqual({ ok: false, refusal: UsbAudioRefusal.CARD_ABSENT });
  });

  it('a card that is not USB is found by its kernel name, and only while no USB card carries that name', async () => {
    const onboard: FixtureCard = { index: 0, id: 'PCH', product: 'Onboard', channels: 2 };
    const found = identifyRegisteredCard(await hostOf([onboard, DUO]).enumerator.list(), row('MIC-01', onboard, 2));
    expect(found.ok && [found.card.cardIndex, found.card.usb]).toEqual([0, false]);
    expect(identifyRegisteredCard(await hostOf([DUO]).enumerator.list(), row('MIC-01', onboard, 2))).toEqual({ ok: false, refusal: UsbAudioRefusal.CARD_ABSENT });
  });
});

// ── 4. start and close ────────────────────────────────────────────────────────────────────────

describe('start: under the guard, through the production door, after one more listing', () => {
  it('the guard is started with the helper program and the vector of the open, the configuration path as the one environment key, no start message', async () => {
    const r = rig([DUO], [row('MIC-01', DUO, 2)]);
    const stream = await r.adapter.open('MIC-01', target());
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    expect(r.door.guardCalls()).toEqual([{ command: GUARD, args: [HELPER, ...vector(2, 'dems_1_0', 'pan=mono|c0=c1', `${r.runDir}/SES-67/MIC-01.pcm`)], env: { ALSA_CONFIG_PATH: r.configPath }, message: null }]);
    expect([...guardedArguments('/a/helper', ['-x', 'y'])]).toEqual(['/a/helper', '-x', 'y']);
    // The start read the cards once more.
    expect(r.host.lists()).toBe(2);
    expect([stream.started(), stream.guardPid()]).toEqual([true, 7000]);
    // A handle starts once.
    expect((await refusalOf(stream.start())).code).toBe(UsbAudioRefusal.ALREADY_OPEN);
    expect(r.door.guards).toHaveLength(1);
    await stream.close();
  });

  it('the card is no longer where the open found it: AUDIO_CARD_MOVED and no helper; a card gone since the open: AUDIO_CARD_ABSENT', async () => {
    const r = rig([DUO, OCTO], [row('MIC-02', OCTO, 3)]);
    const stream = await r.adapter.open('MIC-02', target());
    r.host.cards = [DUO, { ...OTHER, index: 2 }, { ...OCTO, index: 4 }];
    const moved = await refusalOf(stream.start());
    expect([moved.code, moved.wireCode]).toEqual(['AUDIO_CARD_MOVED', 'DEVICE_NOT_FOUND']);
    expect(r.door.guards).toEqual([]);
    await stream.close();
    // A new open finds it where it is now.
    const again = await r.adapter.open('MIC-02', target());
    expect(again.helperArguments).toContain('dems_4_0');
    r.host.cards = [DUO];
    expect((await refusalOf(again.start())).code).toBe(UsbAudioRefusal.CARD_ABSENT);
    expect(r.door.guards).toEqual([]);
    await again.close();
  });

  it('a start the door refuses, a helper that ends at its start, an aborted start', async () => {
    const refused = rig([DUO], [row('MIC-01', DUO, 1)], () => ({ refuses: ProductionDoorRefusal.CORE_FILE_LIMIT_NOT_ZERO }));
    const one = await refused.adapter.open('MIC-01', target());
    const door = await refusalOf(one.start());
    expect([door.code, door.detail]).toEqual(['AUDIO_HELPER_NOT_STARTED', 'PRODUCTION_CORE_FILE_LIMIT_NOT_ZERO']);
    await one.close();

    const ending = rig([DUO], [row('MIC-01', DUO, 1)], () => ({ ends: { exitCode: 1, diagnostics: 'cannot open audio device dems_1_0 (Device or resource busy)' } }));
    const two = await ending.adapter.open('MIC-01', target());
    const ended = await refusalOf(two.start());
    expect([ended.code, ended.detail, ended.wireCode]).toEqual(['AUDIO_HELPER_ENDED_AT_START', 'EXIT_1', 'OPEN_FAILED']);
    // No text of the helper is in the refusal.
    expect(JSON.stringify([ended.message, ended.detail, ended.code])).not.toMatch(/dems_1_0|busy/);
    await two.close();

    const aborting = rig([DUO], [row('MIC-01', DUO, 1)]);
    const three = await aborting.adapter.open('MIC-01', target());
    const gone = new AbortController();
    const outcome = three.start(gone.signal).catch((error: unknown) => error);
    await until(() => aborting.timers.pending().includes(USB_AUDIO_LIMITS.settleMs), 'the settle timer');
    gone.abort();
    expect(((await outcome) as UsbAudioError).code).toBe(UsbAudioRefusal.ABORTED);
    // Stopped through the guard's input, not by a signal.
    expect(aborting.door.guards[0]?.orders).toEqual(['END_INPUT']);
    await three.close();
  });

  it('a helper that ends during the session is told once as lost; one that reports no sample within the bound is stopped through the guard and told as such', async () => {
    const r = rig([DUO], [row('MIC-01', DUO, 1)]);
    const stream = await r.adapter.open('MIC-01', target());
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    r.door.guards[0]?.endNow({ exitCode: 1 });
    await until(() => r.lost.length === 1, 'the loss');
    expect(r.lost.map(([deviceId, error]) => [deviceId, error.code, error.wireCode, error.detail])).toEqual([['MIC-01', 'AUDIO_HELPER_EXITED', 'HELPER_EXITED', 'EXIT_1']]);
    expect(r.adapter.livePids().size).toBe(0);
    // The handle is spent: a helper that has ended is not started again on it.
    expect((await refusalOf(stream.start())).code).toBe(UsbAudioRefusal.ALREADY_OPEN);
    await stream.close();
    expect(r.lost).toHaveLength(1);

    const silent = rig([DUO], [row('MIC-01', DUO, 1)], () => ({}));
    const quiet = await silent.adapter.open('MIC-01', target());
    expect(await startAndSettle(quiet, silent.timers)).toBeNull();
    expect(silent.timers.fire(USB_AUDIO_LIMITS.firstSampleMs)).toBe(true);
    await until(() => silent.lost.length === 1, 'the starved helper');
    expect(silent.lost[0]?.[1].code).toBe(UsbAudioRefusal.NO_SAMPLE);
    expect(silent.door.guards[0]?.orders).toEqual(['END_INPUT']);
    await quiet.close();
  });
});

describe('close: the end of the guard\'s input first, a signal only when that is not obeyed', () => {
  it('ends the guard through its input, removes the pipe and frees the input; twice is once', async () => {
    const r = rig([DUO], [row('MIC-01', DUO, 1)]);
    const stream = await r.adapter.open('MIC-01', target());
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    const closing = stream.close();
    expect(stream.close()).toBe(closing);
    await closing;
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT']);
    expect(r.door.guards[0]?.alive()).toBe(false);
    expect(existsSync(`${r.runDir}/SES-67/MIC-01.pcm`)).toBe(false);
    expect(r.adapter.openSources()).toEqual([]);
    expect(r.lost).toEqual([]);
    expect(r.notices).toEqual([]);
    // The input can be opened again, for the same session: the pipe is made again at the same path.
    const again = await r.adapter.open('MIC-01', target());
    expect(again.input.path).toBe(stream.input.path);
    await again.close();
  });

  it('a guard that does not end: SIGTERM after the grace, SIGKILL after the second one, and it is told', async () => {
    const r = rig([DUO], [row('MIC-01', DUO, 1)], () => ({ reports: PROGRESS, ignoresInputEnd: true, ignoresTerm: true }));
    const stream = await r.adapter.open('MIC-01', target());
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    const closing = stream.close();
    await until(() => r.timers.pending().includes(USB_AUDIO_LIMITS.stopGraceMs), 'the grace');
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT']);
    r.timers.fire(USB_AUDIO_LIMITS.stopGraceMs);
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT', 'SIGTERM']);
    r.timers.fire(USB_AUDIO_LIMITS.stopGraceMs + USB_AUDIO_LIMITS.killGraceMs);
    await closing;
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT', 'SIGTERM', 'SIGKILL']);
    expect(r.notices).toEqual([{ code: UsbAudioNoticeCode.HELPER_SIGNALLED, deviceId: 'MIC-01' }]);
    expect(r.lost).toEqual([]);
  });
});

// ── 5. The pre-check, the level, the list of inputs, the source facts ─────────────────────────

describe('pre-check, level, enumerate, source facts', () => {
  it('the pre-check: one short open of all channels through the shared capture under the guard, nothing selected and nothing written', async () => {
    const r = rig([DUO, OCTO], [row('MIC-02', OCTO, 3)], () => ({ ends: { exitCode: 0 } }));
    expect(await r.adapter.precheck('MIC-02')).toBeNull();
    expect(r.door.calls).toEqual([
      {
        command: GUARD,
        args: [HELPER, '-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning', '-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-ch_layout', '8C', '-sample_rate', '48000', '-i', 'dems_2_0', '-t', '0.2', '-vn', '-f', 'null', '-'],
        env: { ALSA_CONFIG_PATH: r.configPath },
        message: null,
      },
    ]);
    expect(r.configText()).toBe(INCLUDE + sharedBlock(2, 8, 'S32_LE', 52_064));
    // Nothing is held open by a pre-check, and no pipe was made.
    expect(r.adapter.openSources()).toEqual([]);
    expect(existsSync(`${r.runDir}/SES-67`)).toBe(false);
  });

  it('the pre-check answers the named refusal: a failed open, an open that does not end, an absent card, an input beyond the card', async () => {
    const failing = rig([DUO], [row('MIC-01', DUO, 1)], () => ({ ends: { exitCode: 1 } }));
    const failed = await failing.adapter.precheck('MIC-01');
    expect(failed).toBeInstanceOf(UsbAudioError);
    expect([(failed as UsbAudioError).code, (failed as UsbAudioError).detail]).toEqual(['AUDIO_HELPER_ENDED_AT_START', 'EXIT_1']);

    const hanging = rig([DUO], [row('MIC-01', DUO, 1)], () => ({}));
    const outcome = hanging.adapter.precheck('MIC-01');
    await until(() => hanging.timers.pending().includes(USB_AUDIO_LIMITS.precheckTimeoutMs), 'the bound of the pre-check');
    hanging.timers.fire(USB_AUDIO_LIMITS.precheckTimeoutMs);
    expect(((await outcome) as UsbAudioError).code).toBe(UsbAudioRefusal.PRECHECK_TIMEOUT);
    expect(hanging.door.guards[0]?.orders).toEqual(['END_INPUT']);

    const absent = rig([DUO], [row('MIC-02', OCTO, 3)]);
    expect(((await absent.adapter.precheck('MIC-02')) as UsbAudioError).code).toBe(UsbAudioRefusal.CARD_ABSENT);
    expect(absent.door.calls).toEqual([]);
    const beyond = rig([{ ...OCTO, channels: 2 }], [row('MIC-02', OCTO, 3)]);
    expect(await beyond.adapter.precheck('MIC-02')).toBeInstanceOf(AudioInputBeyondCardError);
    expect(beyond.door.calls).toEqual([]);
  });

  it('enumerate: one listing for all registered microphones, each present or named; it starts nothing', async () => {
    const r = rig([DUO, { ...OTHER, index: OCTO.index, id: OCTO.id }], [row('MIC-01', DUO, 1), row('MIC-02', OCTO, 3), row('MIC-03', { ...OCTO, id: 'Gone', usbId: '9999:0001' }, 1)]);
    expect(await r.adapter.enumerate()).toEqual([
      { inputId: 'MIC-01', present: true, errorCode: null },
      { inputId: 'MIC-02', present: false, errorCode: AudioInputErrorCode.DEVICE_NOT_FOUND },
      { inputId: 'MIC-03', present: false, errorCode: AudioInputErrorCode.DEVICE_NOT_FOUND },
    ]);
    expect(r.host.lists()).toBe(1);
    expect(r.door.calls).toEqual([]);
    r.host.failing = true;
    expect((await r.adapter.enumerate()).map((entry) => [entry.present, entry.errorCode])).toEqual([[false, 'OPEN_FAILED'], [false, 'OPEN_FAILED'], [false, 'OPEN_FAILED']]);
  });

  it('level: the telemetry reading at most 0 dBFS, null for none; source facts: of an open input only, from what the open found', async () => {
    const readings = new Map<string, number | null>([['MIC-01', -23.5]]);
    const r = rig([DUO], [row('MIC-01', DUO, 2)], undefined, { level: (inputId) => readings.get(inputId) ?? null });
    expect(await r.adapter.level('MIC-01')).toBe(-23.5);
    readings.set('MIC-01', 1.5);
    expect(await r.adapter.level('MIC-01')).toBe(0);
    readings.set('MIC-01', Number.NaN);
    expect(await r.adapter.level('MIC-01')).toBeNull();
    readings.set('MIC-01', null);
    expect(await r.adapter.level('MIC-01')).toBeNull();
    await expect(r.adapter.level('MIC-09')).rejects.toBeInstanceOf(CaptureAdapterError);
    expect(await rig([DUO], [row('MIC-01', DUO, 2)]).adapter.level('MIC-01')).toBeNull();

    expect(r.adapter.sourceFacts('MIC-01')).toBeNull();
    const stream = await r.adapter.open('MIC-01', target());
    const lists = r.host.lists();
    expect(r.adapter.sourceFacts('MIC-01')).toEqual({ product: 'DEMS Test Duo', usbId: '1a2b:0001', usbSerial: null, usbPort: '0000:00:14.0-2', cardId: 'Duo', cardDevice: 0, inputNumber: 2, nativeChannels: 2, sampleRateHz: 48_000, sampleBits: 24 });
    expect(r.host.lists()).toBe(lists);
    await stream.close();
    expect(r.adapter.sourceFacts('MIC-01')).toBeNull();
  });
});

// ── 5b. The door of a later device (task 4 row 85d; decision C63 (g)) ─────────────────────────
//
// A microphone registered on a RUNNING production Core: its stored row exists (the rig's `rows` is the store the adapter
// reads at every open), the adapter was built without it. `admitDevice` makes THIS adapter serve it - the same
// configuration writer, the same allocations - and everything that follows is the path of any other microphone.
describe('row 85d: `admitDevice` - a microphone registered after the build is served by the same adapter, by its stored identity', () => {
  /** The adapter was built for MIC-02 (the Octo); MIC-03 (input 2 of the Duo) is registered afterwards. */
  const later = (cards: FixtureCard[] = [DUO, OCTO], script?: (call: DoorCall, index: number) => Script): Rig => {
    const r = rig(cards, [row('MIC-02', OCTO, 3)], script);
    r.rows.set('MIC-03', row('MIC-03', DUO, 2));
    return r;
  };
  const codeOfThrow = (act: () => void): unknown => {
    try {
      act();
    } catch (error) {
      return error instanceof CaptureAdapterError ? error.code : error;
    }
    return 'ADMITTED';
  };

  it('before the admission the stored row alone serves nothing; the admission itself lists no card, writes no configuration, makes no pipe and starts no program', async () => {
    const r = later();
    await expect(r.adapter.open('MIC-03', target())).rejects.toMatchObject({ name: 'CaptureAdapterError', code: 'CAPTURE_DEVICE_UNKNOWN' });
    await expect(r.adapter.precheck('MIC-03')).rejects.toMatchObject({ code: 'CAPTURE_DEVICE_UNKNOWN' });
    await expect(r.adapter.level('MIC-03')).rejects.toMatchObject({ code: 'CAPTURE_DEVICE_UNKNOWN' });
    expect((await r.adapter.enumerate()).map((entry) => entry.inputId)).toEqual(['MIC-02']);
    const lists = r.host.lists();
    expect(r.adapter.admittedDevices()).toEqual([]);
    r.adapter.admitDevice(entryOf('MIC-03'));
    expect([r.host.lists() - lists, r.door.calls, r.adapter.openSources(), existsSync(r.configPath), existsSync(`${r.runDir}/SES-67`)]).toEqual([0, [], [], false, false]);
    expect(r.adapter.admittedDevices()).toEqual([entryOf('MIC-03')]);
    expect(Object.isFrozen(r.adapter.admittedDevices()[0])).toBe(true);
    // The first list is what it was: the registry takes the later device as an entry of its own.
    expect(r.adapter.devices.map((entry) => entry.id)).toEqual(['MIC-02']);
  });

  it('after it: open, pre-check, level and the enumeration serve it as a microphone of the first list - found by its STORED identity in a fresh listing, arguments from integers, ONE configuration for the cards of both microphones', async () => {
    const r = later();
    r.adapter.admitDevice(entryOf('MIC-03'));
    const first = await r.adapter.open('MIC-02', target());
    const lists = r.host.lists();
    const stream = await r.adapter.open('MIC-03', target());
    expect(r.host.lists() - lists).toBe(1);
    const pipe = `${r.runDir}/SES-67/MIC-03.pcm`;
    expect([...stream.helperArguments]).toEqual(vector(2, 'dems_1_0', 'pan=mono|c0=c1', pipe));
    expect(stream.card).toMatchObject({ cardIndex: 1, channelCount: 2, inputNumber: 2, cardId: 'Duo', usbPort: DUO.port });
    // ONE writer, ONE file: the entry of the first microphone's card and the entry of the later one's.
    expect(r.configText()).toBe(INCLUDE + sharedBlock(1, 2, 'S24_3LE', 52_032) + sharedBlock(2, 8, 'S32_LE', 52_064));
    expect(r.adapter.openSources()).toEqual(['MIC-02', 'MIC-03']);
    expect(r.adapter.sourceFacts('MIC-03')).toMatchObject({ cardId: 'Duo', inputNumber: 2, nativeChannels: 2 });
    expect(await r.adapter.enumerate()).toEqual([
      { inputId: 'MIC-02', present: true, errorCode: null },
      { inputId: 'MIC-03', present: true, errorCode: null },
    ]);
    expect(await r.adapter.level('MIC-03')).toBeNull();
    // A second open of the admitted microphone is refused as for any other; its helper starts under the guard, once.
    expect((await refusalOf(r.adapter.open('MIC-03', target()))).code).toBe(UsbAudioRefusal.ALREADY_OPEN);
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    expect(r.door.guardCalls()).toHaveLength(1);
    await stream.close();
    await first.close();
    expect(r.adapter.openSources()).toEqual([]);
    // The pre-check of the admitted microphone: the one short open, as for any other.
    const checking = later([DUO, OCTO], () => ({ ends: { exitCode: 0 } }));
    checking.adapter.admitDevice(entryOf('MIC-03'));
    expect(await checking.adapter.precheck('MIC-03')).toBeNull();
    expect(checking.door.calls.map((call) => [call.command, call.args[0], call.args.includes('dems_1_0')])).toEqual([[GUARD, HELPER, true]]);
  });

  it('the stored identity rules hold for it: a same-model card on ANOTHER port is AUDIO_CARD_CHANGED with nothing started; an admitted id with no stored row is AUDIO_INPUT_NOT_REGISTERED', async () => {
    const swapped = later([{ ...DUO, port: '0000:00:14.0-7' }, OCTO]);
    swapped.adapter.admitDevice(entryOf('MIC-03'));
    const refused = await refusalOf(swapped.adapter.open('MIC-03', target()));
    expect([refused.code, refused.detail, refused.deviceId]).toEqual(['AUDIO_CARD_CHANGED', 'PORT_DIFFERS', 'MIC-03']);
    expect([swapped.door.calls, swapped.adapter.openSources(), existsSync(swapped.configPath)]).toEqual([[], [], false]);
    expect(await swapped.adapter.enumerate()).toEqual([
      { inputId: 'MIC-02', present: true, errorCode: null },
      { inputId: 'MIC-03', present: false, errorCode: AudioInputErrorCode.DEVICE_NOT_FOUND },
    ]);
    const rowless = rig([DUO, OCTO], [row('MIC-02', OCTO, 3)]);
    rowless.adapter.admitDevice(entryOf('MIC-04'));
    expect((await refusalOf(rowless.adapter.open('MIC-04', target()))).code).toBe(UsbAudioRefusal.INPUT_NOT_REGISTERED);
    expect(rowless.door.calls).toEqual([]);
  });

  it('idempotent: a second admission, and the admission of a microphone of the first list, change nothing - an open source of it stays open', async () => {
    const r = later();
    r.adapter.admitDevice(entryOf('MIC-03'));
    const stream = await r.adapter.open('MIC-03', target());
    r.adapter.admitDevice(entryOf('MIC-03'));
    r.adapter.admitDevice({ ...entryOf('MIC-03'), label: 'another label' });
    r.adapter.admitDevice(entryOf('MIC-02'));
    expect(r.adapter.admittedDevices()).toEqual([entryOf('MIC-03')]);
    expect(r.adapter.devices.map((entry) => entry.id)).toEqual(['MIC-02']);
    expect(r.adapter.openSources()).toEqual(['MIC-03']);
    expect((await r.adapter.enumerate()).map((entry) => entry.inputId)).toEqual(['MIC-02', 'MIC-03']);
    await stream.close();
  });

  it('refused, each by its name and with nothing changed: no entry, another class, an id of another class, another adapter kind, another source class, a capability or a profile that is not a microphone\'s', async () => {
    const r = later();
    const mic = entryOf('MIC-03');
    const cases: readonly [string, unknown, string][] = [
      ['null', null, 'CAPTURE_DEVICE_UNKNOWN'],
      ['a text', 'MIC-03', 'CAPTURE_DEVICE_UNKNOWN'],
      ['no id', { ...mic, id: undefined }, 'CAPTURE_DEVICE_UNKNOWN'],
      ['a camera', { id: 'CAM-03', deviceClass: 'CAMERA', label: 'Camera', capabilities: ['VIDEO'], profiles: ['H264_1080P25'] }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['a switch', { id: 'POE-01', deviceClass: 'POE', label: 'Switch', capabilities: [], profiles: [] }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['a camera id under the class MIC', { ...mic, id: 'CAM-03' }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['an id that is no registry id', { ...mic, id: 'MIC-3; rm' }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['a microphone id under the class CAMERA', { ...mic, deviceClass: 'CAMERA' }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['the development device kind', { ...mic, adapterKind: CaptureAdapterKind.LOCAL_DEVICE }, 'CAPTURE_ADAPTER_KIND_NOT_ALLOWED'],
      ['the fake kind', { ...mic, adapterKind: CaptureAdapterKind.FAKE }, 'CAPTURE_ADAPTER_KIND_NOT_ALLOWED'],
      ['the development source class', { ...mic, adapterKind: CaptureAdapterKind.USB_AUDIO, sourceClass: 'DEVELOPMENT' }, 'DEVELOPMENT_SOURCE_NOT_ALLOWED'],
      ['a video capability', { ...mic, capabilities: ['AUDIO', 'VIDEO'] }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['no capability', { ...mic, capabilities: [] }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['a media profile', { ...mic, profiles: ['H264_1080P25'] }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
      ['no label', { ...mic, label: 7 }, 'CAPTURE_DEVICE_CLASS_MISMATCH'],
    ];
    for (const [label, entry, code] of cases) expect(codeOfThrow(() => r.adapter.admitDevice(entry as CaptureDeviceEntry)), label).toBe(code);
    expect(r.adapter.admittedDevices()).toEqual([]);
    await expect(r.adapter.open('MIC-03', target())).rejects.toMatchObject({ code: 'CAPTURE_DEVICE_UNKNOWN' });
    expect([r.host.lists(), r.door.calls]).toEqual([0, []]);
    // CONTROL: a descriptor that states THIS adapter's kind and the production class is taken.
    expect(codeOfThrow(() => r.adapter.admitDevice({ ...mic, adapterKind: CaptureAdapterKind.USB_AUDIO, sourceClass: 'PRODUCTION', hasOpener: true } as CaptureDeviceEntry))).toBe('ADMITTED');
    expect(r.adapter.admittedDevices()).toEqual([mic]);
  });

  it('the fence\'s door finds the member, and its one-entry view of the adapter serves the later microphone; SINCE THE LIFT (row 88) a production registry takes that view and it records; a development Core does not register the kind', async () => {
    const r = later();
    // What `buildProductionRegistryOf` does with a later device (`capture/fence/index.ts`, `lateDoorOf` and `admitLater`).
    const member = (r.adapter as unknown as Record<string, unknown>)['admitDevice'];
    expect(typeof member).toBe('function');
    const entry = entryOf('MIC-03');
    (member as (entry: CaptureDeviceEntry) => void).call(r.adapter, entry);
    const view = Object.freeze({ ...r.adapter, devices: Object.freeze([entry]) });
    expect([view.kind, view.hasOpener, view.devices.map((device) => device.id)]).toEqual([CaptureAdapterKind.USB_AUDIO, true, ['MIC-03']]);
    const stream = await view.open('MIC-03', target());
    expect(r.adapter.openSources()).toEqual(['MIC-03']);
    await stream.close();
    // Row 88 (AM-1): in production the kind has its opener since the lift - the view is taken and recordable; a development Core does not register the kind at all.
    const production = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
    production.register(view);
    expect(production.assertRecordable('MIC-03').id).toBe('MIC-03');
    const development = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT });
    expect(codeOfThrow(() => development.register(view))).toBe('CAPTURE_ADAPTER_KIND_NOT_ALLOWED');
    expect(development.list()).toEqual([]);
  });
});

// ── 6. T-3, and the static half of the row ────────────────────────────────────────────────────

describe('T-3 and the static rules of the row', () => {
  const FILE = 'src/capture/adapters/audio/usb-audio-production.ts';
  const tree = codeOnly(readTree(WORKSPACE).filter((file) => /\.[cm]?tsx?$/.test(file.path)));
  const source = tree.find((file) => file.path === FILE)?.text ?? '';

  // T-3, REWRITTEN BY ROW 88 (THE LIFT, AM-1): a production registry takes the adapter and its device records; a development
  // registry does not register the kind (and would refuse its opener: design addendum 1.4 #7).
  it('T-3 since the lift: a production registry takes the adapter - the kind may state an opener - and a development registry refuses the kind', () => {
    const adapter = rig([DUO], [row('MIC-01', DUO, 1)]).adapter;
    expect([adapter.seam, adapter.kind, adapter.hasOpener]).toEqual(['AUDIO', CaptureAdapterKind.USB_AUDIO, true]);
    const thrownBy = (call: () => void): unknown => {
      try {
        call();
      } catch (error) {
        return error;
      }
      return null;
    };
    const production = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
    expect(thrownBy(() => production.register(adapter))).toBeNull();
    expect(production.openerKinds()).toEqual(['USB_AUDIO']);
    expect(production.assertRecordable('MIC-01').id).toBe('MIC-01');
    const development = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT });
    const refused = thrownBy(() => development.register(adapter));
    expect(refused).toBeInstanceOf(CaptureAdapterError);
    expect((refused as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.ADAPTER_KIND_NOT_ALLOWED);
  });

  it('since the lift (row 88): the loader builds the adapter on linux, the fence takes its card match; the macOS adapter shares its code; no other production file imports it', () => {
    expect(source.length).toBeGreaterThan(5_000);
    const importers = relativeImports(tree.filter((file) => isProductionSource(file.path))).filter((entry) => entry.target === FILE.replace(/\.ts$/, ''));
    // MOVED BY ROW N9 (design 06 s4.4: the logic "may be shared AS CODE: identifyRegisteredCard, UsbAudioError, the refusal tables,
    // guardedArguments, isRegisteredAudioInput"): the macOS adapter imports those from this file (rule A-9). Row 88: the loader
    // (a type import and the dynamic import of the build) and the fence's boot step (the card match of the loss watch).
    expect([...new Set(importers.map((entry) => entry.file))].sort()).toEqual(['src/capture/adapters/audio/usb-audio-macos.ts', 'src/capture/adapters/real.ts', 'src/capture/fence/index.ts']);
    const loader = tree.find((file) => file.path === 'src/capture/adapters/real.ts')?.text ?? '';
    expect(loader).toMatch(/await import\('\.\/audio\/usb-audio-production'\)/);
    // The adapter without an opener is still what a host without a microphone opener gets.
    expect(loader).toMatch(/await import\('\.\/audio\/usb-audio'\)/);
    // Control: a planted importer is seen.
    expect(relativeImports([{ path: 'src/capture/adapters/real.ts', text: "await import('./audio/usb-audio-production');\n" }]).map((entry) => entry.target)).toEqual([FILE.replace(/\.ts$/, '')]);
  });

  it('argument origin: the two table functions are called once each with integers of the live listing and the registered input number; the door is handed nothing else', () => {
    const flat = source.replace(/\s+/g, ' ');
    expect(flat.match(/linuxMicPushArguments\(\{[^}]*\}\)/g)).toEqual([
      'linuxMicPushArguments({ cardIndex: located.card.cardIndex, deviceIndex: located.card.deviceIndex, channelCount: located.card.channelCount, inputNumber: located.stored.inputNumber, pipePath, deviceId: inputId, })',
    ]);
    expect(flat.match(/linuxMicPrecheckArguments\(\{[^}]*\}\)/g)).toEqual(['linuxMicPrecheckArguments({ cardIndex: located.card.cardIndex, deviceIndex: located.card.deviceIndex, channelCount: located.card.channelCount })']);
    // The three starts, and what each is handed as its argument list.
    expect(flat.match(/\bdoor\(\{ command: [^,]+, args(?:: (?:[\w.]+\([^)]*\)|[\w.]+))?,/g)).toEqual([
      'door({ command: asked.command, args: asked.args,',
      'door({ command: guardProgram, args: guardedArguments(helperProgram, helperArguments),',
      'door({ command: guardProgram, args,',
    ]);
    expect(flat).toMatch(/const run = await runShort\(inputId, guardedArguments\(helperProgram, args\), config\.environment, signal\);/);
    expect(flat).toMatch(/return Object\.freeze\(\[helperProgram, \.\.\.helperArguments\]\);/);
    // No argument is composed here: no template with a value and no joined text ends in an argument list.
    expect(flat.match(/\bargs\b[^;]*`[^`]*\$\{/g)).toBeNull();
    // The file names neither the device layer nor a card by text, and reads no stored member but through the row.
    expect(source).not.toMatch(/'alsa'|hw:|plughw|CARD=/);
    // Control: a vector that takes a text of the listing would be seen by the first rule.
    expect('linuxMicPushArguments({ cardIndex: located.card.cardIndex, deviceIndex: located.card.deviceIndex, channelCount: located.card.channelCount, inputNumber: located.stored.inputNumber, pipePath, deviceId: located.card.cardId, })').not.toBe(flat.match(/linuxMicPushArguments\(\{[^}]*\}\)/g)?.[0]);
  });

  it('no text of the stored row and no text of the listing is in any argument or in the configuration (planted values)', async () => {
    const planted: FixtureCard = { index: 6, id: 'Zq7_Marker', product: 'Qx9 Planted Name', usbId: 'f00d:beef', port: '0000:00:1d.7-9.4', serial: 'Vk3-SERIAL-MARK', channels: 4, format: 'S24_LE' };
    const r = rig([planted], [row('MIC-01', planted, 4)], () => ({ ends: { exitCode: 0 } }));
    const stream = await r.adapter.open('MIC-01', target());
    await r.adapter.precheck('MIC-01');
    await stream.start().catch(() => undefined);
    await stream.close();
    const everything = JSON.stringify([r.door.calls.map((call) => [call.command, call.args, call.env]), r.configText()]);
    // Row 200: the stored row now holds a serial and a port path, and the open matched by them - neither reaches an argument, the environment or the configuration.
    expect([stream.card.usbSerial, stream.card.usbPort]).toEqual(['Vk3-SERIAL-MARK', '0000:00:1d.7-9.4']);
    for (const text of ['Zq7_Marker', 'Qx9', 'Planted', 'f00d', 'beef', '1d.7-9.4', 'Vk3', 'SERIAL-MARK', 'S24_LE'.toLowerCase()]) expect(everything.includes(text), text).toBe(false);
    // What IS there: the integers of the listing, and the format as a word of the generator's closed list in the configuration only.
    expect(stream.helperArguments).toEqual(vector(4, 'dems_6_0', 'pan=mono|c0=c3', `${r.runDir}/SES-67/MIC-01.pcm`));
    expect(r.door.calls.flatMap((call) => call.args).some((arg) => arg.includes('S24_LE'))).toBe(false);
  });

  it('the file starts no process, reads no clock and names no global timer of its own; it does not log', () => {
    expect(source).not.toMatch(/node:(?:fs|child_process|net|os)|\bDate\b|\bsetTimeout\b|\bsetInterval\b|\bconsole\b|process\.env/);
    expect(source.match(/from '[^']+'/g)).toEqual([
      "from '@dems/capture-protocol'",
      "from '../../types'",
      "from '../errors'",
      "from '../kinds'",
      "from '../local/camera-helper'",
      "from '../local/helper-program'",
      "from '../local/mic-helper-args'",
      "from '../local/mic-pipe'",
      "from '../local/pipe-files'",
      "from '../local/process-door'",
      "from '../mic-transport'",
      "from '../production-door'",
      "from '../types'",
      "from './alsa-config'",
      "from './card-listing'",
    ]);
  });
});

// ── 7. Real processes: the stand-in guard, the stand-in helper, a real pipe (P12-F13) ─────────

/** Channel `c`, frame `i` of the generated source: a signed 24-bit value, different for every channel. */
const sampleOf = (channel: number, frame: number): number => (((channel + 1) * 1_000_003 + frame * (7_919 + 2 * channel)) % 16_777_216) - 8_388_608;
const FRAMES = 2_400;

const STAND_IN_GUARD = `#!${process.execPath}
// A stand-in for the guard program of row 23: it starts its first argument with the rest, hands
// it its own output and environment, and ends it when its own standard input ends.
const { spawn } = require('node:child_process');
const [program, ...rest] = process.argv.slice(2);
const child = spawn(program, rest, { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
let over = false;
const end = () => { if (!over) child.kill('SIGTERM'); };
process.stdin.on('end', end);
process.stdin.on('close', end);
process.stdin.resume();
process.on('SIGTERM', end);
child.on('error', () => process.exit(127));
child.on('exit', (code, signal) => { over = true; process.exit(code === null ? (signal ? 143 : 1) : code); });
`;

const STAND_IN_HELPER = `#!${process.execPath}
// A stand-in for the helper on Linux. It PARSES its argument vector option by option, as the
// program does: an option it does not know, a missing value or a value of another form ends it
// with a status of its own. It then looks its device up in the configuration its environment
// names, generates a source of as many channels as it was told to open, selects the one channel
// its filter names and writes 32-bit float, mono, into its output.
const fs = require('node:fs');
const path = require('node:path');
const fail = (status, why) => { process.stderr.write('stand-in helper: ' + why + '\\n'); process.exit(status); };
const VALUES = { '-hide_banner': 0, '-nostdin': 0, '-nostats': 0, '-vn': 0, '-y': 0, '-loglevel': 1, '-progress': 1, '-thread_queue_size': 1, '-f': 1, '-c:a': 1, '-ch_layout': 1, '-sample_rate': 1, '-i': 1, '-af': 1, '-ac': 1, '-ar': 1, '-flush_packets': 1, '-t': 1 };
const argv = process.argv.slice(2);
const input = {}; const output = {}; let device = null; let target = null;
for (let at = 0; at < argv.length; at += 1) {
  const word = argv[at];
  if (word !== '-' && word.startsWith('-')) {
    if (!(word in VALUES)) fail(64, 'unknown option');
    const side = device === null ? input : output;
    if (word in side) fail(64, 'option given twice');
    if (VALUES[word] === 0) { side[word] = true; continue; }
    at += 1;
    if (at >= argv.length) fail(64, 'option without a value');
    if (word === '-i') { if (device !== null) fail(64, 'second input'); device = argv[at]; } else side[word] = argv[at];
  } else {
    if (device === null || target !== null) fail(64, 'a word that is no option');
    target = word;
  }
}
if (device === null || target === null) fail(64, 'no input or no output');
if (input['-f'] !== 'alsa') fail(65, 'not the sound device layer');
if (input['-c:a'] !== 'pcm_s24le' || input['-sample_rate'] !== '48000') fail(65, 'another capture form');
// Row 79b (C89): the channel count is the layout word of the pinned program, '<n>C'; '-channels' is no option of it.
if (!/^[1-9][0-9]?C$/.test(input['-ch_layout'] || '')) fail(65, 'channel count');
const channels = Number(input['-ch_layout'].slice(0, -1));
if (!/^dems_[0-9]{1,2}_[0-9]{1,2}$/.test(device)) fail(65, 'device');
// The lookup of the device, as the sound library does it through its configuration path.
const configPath = process.env.ALSA_CONFIG_PATH;
if (!configPath) fail(66, 'no configuration path');
let config = '';
try { config = fs.readFileSync(configPath, 'utf8'); } catch { fail(66, 'configuration not readable'); }
if (!config.includes('pcm.' + device + ' { type plug slave.pcm "' + device + '_shared" }')) fail(67, 'device not in the configuration');
const shared = new RegExp('pcm\\\\.' + device + '_shared \\\\{[^}]*slave \\\\{ pcm "hw:CARD=[0-9]+,DEV=[0-9]+" channels ([0-9]+) rate ([0-9]+) ').exec(config);
if (shared === null) fail(67, 'shared capture not in the configuration');
if (Number(shared[1]) !== channels) fail(67, 'opened with another channel count than the card has');
if (shared[2] !== '48000') fail(67, 'another rate');
fs.appendFileSync(path.join(path.dirname(configPath), 'stand-in-pids.log'), String(process.pid) + '\\n');
if (output['-f'] === 'null') {
  if (target !== '-' || output['-t'] !== '0.2' || '-af' in output) fail(68, 'not the short open');
  process.exit(0);
}
const selection = /^pan=mono\\|c0=c([0-9]{1,2})$/.exec(output['-af'] || '');
if (selection === null) fail(68, 'no selection of one channel');
const selected = Number(selection[1]);
if (selected >= channels) fail(68, 'a channel the device does not have');
if (output['-ac'] !== '1' || output['-ar'] !== '48000' || output['-c:a'] !== 'pcm_f32le' || output['-f'] !== 'f32le') fail(69, 'not the transport');
if (input['-progress'] !== 'pipe:1') fail(69, 'no progress report');
const FRAMES = ${String(FRAMES)};
const sampleOf = (channel, frame) => (((channel + 1) * 1000003 + frame * (7919 + 2 * channel)) % 16777216) - 8388608;
// The source: FRAMES frames of all channels, interleaved, as 24-bit integers.
const source = new Int32Array(FRAMES * channels);
for (let frame = 0; frame < FRAMES; frame += 1) for (let channel = 0; channel < channels; channel += 1) source[frame * channels + channel] = sampleOf(channel, frame);
const out = Buffer.alloc(FRAMES * 4);
for (let frame = 0; frame < FRAMES; frame += 1) out.writeFloatLE(source[frame * channels + selected] / 8388608, frame * 4);
const pipe = fs.createWriteStream(target);
pipe.on('error', () => process.exit(70));
pipe.write(out, () => { process.stdout.write('total_size=' + out.length + '\\nout_time_us=50000\\nprogress=continue\\n'); });
setInterval(() => {}, 1000);
`;

describe('real processes through the real production door: a stand-in guard and helper, a real named pipe', () => {
  const bin = `${root}/bin`;
  const guard = `${bin}/stand-in-guard`;
  const helper = `${bin}/stand-in-helper`;
  // The programs are written by the test and vouched for by path; every other path meets the real rule.
  const inspect = (path: string): ProgramFacts => (path === guard || path === helper ? trustedInspector(uid)() : inspectProgram(path));
  const limits = { settleMs: 200, firstSampleMs: 5_000, stopGraceMs: 3_000, killGraceMs: 2_000, precheckTimeoutMs: 5_000 };

  const live = (cards: FixtureCard[], rows: RegisteredAudioInput[]): { adapter: UsbAudioProductionAdapter; runDir: string; lost: UsbAudioError[]; notices: UsbAudioNotice[] } => {
    if (!existsSync(guard)) {
      // Made once, below the temporary root: executable by the owner only.
      mkdirSync(bin, { recursive: true, mode: 0o700 });
      writeFileSync(helper, STAND_IN_HELPER, { mode: 0o700 });
      writeFileSync(guard, STAND_IN_GUARD, { mode: 0o700 });
    }
    const host = hostOf(cards);
    const runDir = `${root}/case-${String((cases += 1))}/run/capture`;
    const lost: UsbAudioError[] = [];
    const notices: UsbAudioNotice[] = [];
    const adapter = createUsbAudioProductionAdapter({
      devices: rows.map((entry) => entryOf(entry.deviceId)),
      registered: async (deviceId) => rows.find((entry) => entry.deviceId === deviceId) ?? null,
      cards: host.enumerator,
      configWriter: createAlsaConfigWriter(runDir),
      helperProgram: helper,
      guardProgram: guard,
      runDir,
      timers: createSystemTimers(),
      limits,
      door: realDoor,
      inspect,
      onSourceLost: (_deviceId, error) => lost.push(error),
      onNotice: (notice) => notices.push(notice),
    });
    return { adapter, runDir, lost, notices };
  };

  /** Opens the pipe as the worker does, for reading, without waiting for a writer. */
  const reader = (path: string): { read(bytes: number): Promise<Buffer>; close(): void } => {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
    return {
      async read(bytes) {
        const out = Buffer.alloc(bytes);
        let have = 0;
        for (let attempt = 0; attempt < 1_000 && have < bytes; attempt += 1) {
          let got = 0;
          try {
            got = readSync(fd, out, have, bytes - have, null);
          } catch (error) {
            if ((error as { code?: string }).code !== 'EAGAIN') throw error;
          }
          have += got;
          if (got === 0) await new Promise((resolve) => setTimeout(resolve, 5));
        }
        return out.subarray(0, have);
      },
      close: () => closeSync(fd),
    };
  };

  const expected = (channel: number): Float32Array => Float32Array.from({ length: FRAMES }, (_unused, frame) => sampleOf(channel, frame) / 8_388_608);
  const floats = (bytes: Buffer): Float32Array => Float32Array.from({ length: bytes.length / 4 }, (_unused, at) => bytes.readFloatLE(at * 4));
  const equal = (left: Float32Array, right: Float32Array): boolean => left.length === right.length && left.every((value, at) => value === right[at]);
  const alive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const pidsOf = (runDir: string): number[] => (existsSync(`${runDir}/alsa/stand-in-pids.log`) ? readFileSync(`${runDir}/alsa/stand-in-pids.log`, 'utf8').split('\n').filter((line) => line !== '').map(Number) : []);

  it('the pipe carries the SELECTED channel of the source and no other, sample for sample: input 2 of 2, and inputs 1 and 3 of 8 by two handles on one shared capture', async () => {
    const duo = live([DUO], [row('MIC-01', DUO, 2)]);
    const stream = await duo.adapter.open('MIC-01', target());
    const pipe = reader(stream.input.path);
    await stream.start();
    const heard = floats(await pipe.read(FRAMES * 4));
    expect(heard).toHaveLength(FRAMES);
    expect(equal(heard, expected(1))).toBe(true);
    expect(equal(heard, expected(0))).toBe(false);
    // Every sample is a 24-bit value: nothing was lost on the way into the float.
    expect(heard.every((value) => Number.isInteger(value * 8_388_608))).toBe(true);
    await stream.close();
    pipe.close();
    expect(duo.lost).toEqual([]);

    const octo = live([DUO, OCTO], [row('MIC-01', OCTO, 1), row('MIC-02', OCTO, 3)]);
    const first = await octo.adapter.open('MIC-01', target());
    const second = await octo.adapter.open('MIC-02', target());
    const pipes = [reader(first.input.path), reader(second.input.path)] as const;
    await Promise.all([first.start(), second.start()]);
    const [one, three] = [floats(await pipes[0].read(FRAMES * 4)), floats(await pipes[1].read(FRAMES * 4))];
    expect(equal(one, expected(0))).toBe(true);
    expect(equal(three, expected(2))).toBe(true);
    for (let other = 0; other < 8; other += 1) {
      if (other !== 0) expect(equal(one, expected(other)), `input 1 against channel ${other}`).toBe(false);
      if (other !== 2) expect(equal(three, expected(other)), `input 3 against channel ${other}`).toBe(false);
    }
    // Two helpers ran on one configuration with one shared capture.
    expect(pidsOf(octo.runDir)).toHaveLength(2);
    expect(readFileSync(`${octo.runDir}/alsa/dems-alsa.conf`, 'utf8').match(/type dsnoop/g)).toHaveLength(1);
    await octo.adapter.closeAll();
    pipes.forEach((pipe) => pipe.close());
    expect(pidsOf(octo.runDir).filter(alive)).toEqual([]);
    expect([...octo.lost, ...duo.notices, ...octo.notices]).toEqual([]);
  }, 30_000);

  it('the stand-in is no rubber stamp: a vector of another form, another channel count than the configuration, or no configuration path ends it', async () => {
    const duo = live([DUO], [row('MIC-01', DUO, 2)]);
    const stream = await duo.adapter.open('MIC-01', target());
    const config = `${duo.runDir}/alsa/dems-alsa.conf`;
    const run = async (args: readonly string[], env: Record<string, string> = { ALSA_CONFIG_PATH: config }): Promise<number | null> => {
      const running = realDoor({ command: guard, args: [helper, ...args], env, message: null, timers: createSystemTimers() });
      const timer = setTimeout(() => running.endInput(), 1_500);
      const exit = await running.ended;
      clearTimeout(timer);
      return exit.exitCode;
    };
    const good = [...stream.helperArguments];
    const swap = (from: string, to: string): string[] => good.map((arg) => (arg === from ? to : arg));
    expect(await run([...good, '-shortest'])).toBe(64);
    expect(await run(swap('alsa', 'pulse'))).toBe(65);
    expect(await run(swap('dems_1_0', 'hw:CARD=Duo,DEV=0'))).toBe(65);
    expect(await run(swap('dems_1_0', 'dems_9_0'))).toBe(67);
    expect(await run(good.map((arg, at) => (good[at - 1] === '-ch_layout' ? '1C' : arg)))).toBe(67);
    // Row 79b (C89): the row as it was before - the word the pinned program refuses, and a bare count - ends it too.
    expect(await run(swap('-ch_layout', '-channels'))).toBe(64);
    expect(await run(good.map((arg, at) => (good[at - 1] === '-ch_layout' ? '2' : arg)))).toBe(65);
    expect(await run(swap('pan=mono|c0=c1', 'pan=mono|c0=c2'))).toBe(68);
    expect(await run(swap('pan=mono|c0=c1', 'pan=stereo|c0=c0|c1=c1'))).toBe(68);
    expect(await run(good, {})).toBe(66);
    await stream.close();
  }, 30_000);

  it('the pre-check runs the short open for real and answers null; an open of a card that is not in the configuration is told', async () => {
    const octo = live([OCTO], [row('MIC-02', OCTO, 3)]);
    expect(await octo.adapter.precheck('MIC-02')).toBeNull();
    expect(pidsOf(octo.runDir)).toHaveLength(1);
    expect(pidsOf(octo.runDir).filter(alive)).toEqual([]);
  }, 30_000);

  it('20 cycles of open, start and close: every guard and every helper has ended, and no pipe is left', async () => {
    const octo = live([DUO, OCTO], [row('MIC-02', OCTO, 3)]);
    const guards: number[] = [];
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const stream = await octo.adapter.open('MIC-02', target(`SES-C${String(cycle)}`));
      // Odd cycles have a reader (the helper writes), even ones have none (the helper waits at the pipe).
      const pipe = cycle % 2 === 1 ? reader(stream.input.path) : null;
      await stream.start();
      const pid = stream.guardPid();
      expect(pid).not.toBeNull();
      guards.push(pid ?? -1);
      if (pipe !== null) expect((await pipe.read(FRAMES * 4)).length).toBe(FRAMES * 4);
      await stream.close();
      pipe?.close();
      expect(existsSync(stream.input.path)).toBe(false);
    }
    const helpers = pidsOf(octo.runDir);
    expect(guards).toHaveLength(20);
    expect(helpers).toHaveLength(20);
    expect([...guards, ...helpers].filter(alive)).toEqual([]);
    expect(octo.adapter.openSources()).toEqual([]);
    expect(octo.adapter.livePids().size).toBe(0);
    // Every stop was obeyed through the guard's input: no signal was needed, and no helper was reported lost.
    expect(octo.notices).toEqual([]);
    expect(octo.lost).toEqual([]);
  }, 120_000);
});
