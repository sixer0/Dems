// THE macOS PRODUCTION MICROPHONE ADAPTER, kind `USB_AUDIO` (task 4 row N9; masterplan/06 revision 3
// sections 4.6, 4.7, 6, 7.1, 8.1, 9.2; SM-04, SM-14, SM-16, SM-34 (4) (6), SM-35, SM-39; decisions
// C110, C118, C123). NO DEVICE IS OPENED (decision C112: the device run is row N15).
//
// THE DOUBLES.
//   - THE LISTING is the real enumerator of row N6 (`createMacosCardEnumerator`) over texts in the
//     three forms of a macOS host, generated here from a small host description; every name,
//     location and number in them is synthetic. A test changes the description to move the
//     interface to another index, change its rate, add a same-named unit, or confine the Core.
//   - THE HELPER'S LINES are the recorded starts of row N8b (`fixtures/macos-helper-starts/`), with
//     the device index of the launch put in their header.
//   - Blocks 1 to 5: the guard is PLAYED by a door that starts nothing (manual timers): what the
//     adapter refuses, the exact argument vector, the one launch of a group, the pause, the retry,
//     the order of a stop. The pipe maker runs for real through the real production door.
//   - Block 6: REAL PROCESSES through the real production door - a stand-in guard with the built
//     guard's escalation (SIGTERM, then SIGKILL after 2,000 ms), a stand-in helper that checks its
//     argument list against the template word for word, prints the recorded start lines and writes
//     32-bit float into its pipes (and EXITS 224 when the last reader of a pipe is gone, as the
//     pinned helper did in row N4b), and a reader the test holds on each pipe (the keeper).
// NOT proven here: the pinned helper on the device (row N15), the BUILT guard (row 69), the
// product's keeper (a request line: `local/pipe-files.ts` is the one file that touches a pipe).
import { closeSync, constants, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { createSystemTimers } from '../../../timers';
import { CaptureAdapterError } from '../../errors';
import { CaptureAdapterKind } from '../../kinds';
import { manualTimers, trustedInspector, type ManualTimers } from '../../local/__tests__/mic-support';
import { inspectProgram, type ProgramFacts } from '../../local/process-door';
import { startProductionProcess, type ProductionDiagnosticsEvent, type ProductionDoor, type ProductionExit, type ProductionProcess, type ProductionProcessOptions } from '../../production-door';
import { AudioInputBeyondCardError, AudioInputErrorCode, type CaptureDeviceEntry } from '../../types';
import { CaptureMicInputKind } from '@dems/capture-protocol';
import { micTransportOf } from '../../mic-transport';
import { createMacosCardEnumerator, type MacosCardEnumerator } from '../macos-card-listing';
import {
  MACOS_AUDIO_LIMITS,
  MACOS_AUDIO_SENTENCES,
  MACOS_CAPTURE_LAYER,
  MACOS_MIC_TRANSPORT,
  MACOS_SAMPLE_CONTINUITY,
  MacosAudioNoticeCode,
  MacosUsbAudioError,
  createUsbAudioMacosAdapter,
  identifyMacosRegisteredCard,
  type MacosAudioNotice,
  type MacosWatchedListing,
  type MacosHeldPipe,
  type MacosPipeKeeper,
  type UsbAudioMacosAdapter,
  type UsbAudioMacosOptions,
  type UsbAudioMacosStream,
} from '../usb-audio-macos';
import { UsbAudioError, UsbAudioRefusal, type RegisteredAudioInput } from '../usb-audio-production';

// ── The host: three texts in the forms of a macOS host, from a description ─────────────────────

interface FixtureDevice {
  readonly name: string;
  readonly vendor: number;
  readonly product: number;
  readonly location: number;
  readonly serial?: string;
  readonly inputs: number;
  readonly rate: number;
  /** Not in the capture program's list. */
  readonly noCaptureEntry?: boolean;
  /** Not in the system list. */
  readonly noSystemItem?: boolean;
}

interface Host {
  devices: FixtureDevice[];
  /** The capture program's audio list, in order, by name: the index of a device is its place here. */
  captureOrder: string[];
  /** The system list is empty (a confined process, MF1 / M9). */
  confined: boolean;
  failing: boolean;
  readonly enumerator: MacosCardEnumerator;
  lists(): number;
}

const BUILT_IN = 'DEMS Built-in Input';
const HEXA: FixtureDevice = { name: 'DEMS Hexa 6', vendor: 0x1a2b, product: 0x0006, location: 0x01120000, inputs: 6, rate: 48_000 };
const HEXA_PORT = '01120000';
const plistHead = ['<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">', '<plist version="1.0">', ''].join('\n');
const hex8 = (value: number): string => value.toString(16).padStart(8, '0');

function hostOf(devices: FixtureDevice[], captureOrder: string[] = [BUILT_IN, ...devices.map((device) => device.name)]): Host {
  let lists = 0;
  const host: Host = { devices, captureOrder, confined: false, failing: false, enumerator: undefined as unknown as MacosCardEnumerator, lists: () => lists };
  const tree = (): string => {
    const dicts = host.devices.map((device) =>
      [
        '\t<dict>',
        '\t\t<key>IORegistryEntryChildren</key>',
        '\t\t<array>',
        '\t\t\t<dict>',
        '\t\t\t\t<key>bInterfaceClass</key>',
        '\t\t\t\t<integer>1</integer>',
        '\t\t\t\t<key>bInterfaceSubClass</key>',
        '\t\t\t\t<integer>2</integer>',
        '\t\t\t</dict>',
        '\t\t</array>',
        '\t\t<key>IORegistryEntryLocation</key>',
        `\t\t<string>${hex8(device.location)}</string>`,
        '\t\t<key>USB Product Name</key>',
        `\t\t<string>${device.name}</string>`,
        ...(device.serial === undefined ? [] : ['\t\t<key>USB Serial Number</key>', `\t\t<string>${device.serial}</string>`]),
        '\t\t<key>idProduct</key>',
        `\t\t<integer>${device.product}</integer>`,
        '\t\t<key>idVendor</key>',
        `\t\t<integer>${device.vendor}</integer>`,
        '\t\t<key>locationID</key>',
        `\t\t<integer>${device.location}</integer>`,
        '\t</dict>',
      ].join('\n'),
    );
    return `${plistHead}<array>\n${dicts.join('\n')}\n</array>\n</plist>\n`;
  };
  const system = (): string => {
    const items = host.confined
      ? []
      : [
          { _name: BUILT_IN, coreaudio_device_input: 1, coreaudio_device_srate: 48_000, coreaudio_device_transport: 'coreaudio_device_type_builtin' },
          ...host.devices.filter((device) => device.noSystemItem !== true).map((device) => ({ _name: device.name, coreaudio_device_input: device.inputs, coreaudio_device_output: device.inputs, coreaudio_device_srate: device.rate, coreaudio_device_transport: 'coreaudio_device_type_usb' })),
        ];
    return `${JSON.stringify({ SPAudioDataType: [{ _items: items, _name: 'coreaudio_device' }] }, null, 2)}\n`;
  };
  const capture = (): string => {
    const tag = '[AVFoundation indev @ 0x7f8a5c004a00]';
    const audio = host.captureOrder.filter((name) => !host.devices.some((device) => device.name === name && device.noCaptureEntry === true));
    return [`${tag} AVFoundation video devices:`, `${tag} [0] DEMS Synthetic Camera`, `${tag} AVFoundation audio devices:`, ...audio.map((name, index) => `${tag} [${index}] ${name}`), '[in#0 @ 0x7f8a5c005100] Error opening input: Input/output error', 'Error opening input file .', ''].join('\n');
  };
  (host as { enumerator: MacosCardEnumerator }).enumerator = createMacosCardEnumerator({
    async usbTree() {
      lists += 1;
      if (host.failing) throw Object.assign(new Error('the listing program could not be run'), { code: 'ENDED_NONZERO' });
      return tree();
    },
    systemAudio: async () => system(),
    captureDevices: async () => capture(),
  });
  return host;
}

/** The stored row of an input registered on `device`, as the registration stores a macOS card. */
const row = (deviceId: string, device: FixtureDevice, inputNumber: number, patch: Partial<RegisteredAudioInput> = {}): RegisteredAudioInput => ({
  deviceId,
  usbId: `${device.vendor.toString(16).padStart(4, '0')}:${device.product.toString(16).padStart(4, '0')}`,
  usbSerial: device.serial ?? null,
  usbPort: hex8(device.location),
  cardId: `usb_${hex8(device.location)}`,
  cardDevice: 0,
  inputNumber,
  nativeChannels: device.inputs,
  ...patch,
});
const entryOf = (id: string): CaptureDeviceEntry => ({ id, deviceClass: 'MIC', label: id, capabilities: ['AUDIO'], profiles: [] });

// ── The helper's lines: the recorded starts of row N8b ───────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const MARK = '--- helper standard error ---\n';
function fixtureLines(name: string): string[] {
  const text = readFileSync(resolve(HERE, 'fixtures', 'macos-helper-starts', `${name}.txt`), 'utf8');
  return text.slice(text.indexOf(MARK) + MARK.length, -1).split('\n');
}
/** The lines of a start up to (not with) its first queue or closing line: what a helper prints before it records. */
const startPart = (lines: readonly string[]): string[] => lines.slice(0, lines.findIndex((line) => line.startsWith('[fifo @') || line.startsWith('[out#')));
const TWO_OUTPUTS = startPart(fixtureLines('device-two-outputs-48k-queue-lines'));
const ONE_OUTPUT = startPart(fixtureLines('composed-one-output-48k'));
const REFUSED_OPEN = fixtureLines('device-refused-open');
const QUEUE = fixtureLines('device-two-outputs-48k-queue-lines').filter((line) => line.startsWith('[fifo @'));
/** A start of `outputs` outputs for device index `index`, the input's rate and layout as given. */
function startOf(outputs: number, index: number, rate = 48_000, layout = '5.1'): string[] {
  return (outputs === 2 ? TWO_OUTPUTS : ONE_OUTPUT).map((line) => {
    if (line.startsWith('Input #0, ')) return line.replace("'none:0'", `'none:${index}'`);
    if (line.startsWith('  Stream #0:0: Audio:') && line.includes(', start ')) return line.replace('48000 Hz, 5.1,', `${rate} Hz, ${layout},`);
    return line;
  });
}

// ── The played door ───────────────────────────────────────────────────────────────────────────

const PIPE_MAKER = `/usr/bin/${['mk', 'fifo'].join('')}`;
const HELPER = '/opt/dems/bin/ffmpeg';
const GUARD = '/opt/dems/bin/capture-guard';
const exitOf = (patch: Partial<ProductionExit> = {}): ProductionExit => ({ exitCode: 0, signal: null, spawnFailed: false, diagnostics: '', output: '', ...patch });
const realDoor: ProductionDoor = (options) => startProductionProcess({ ...options, coreFileLimit: () => 0 });

interface Script {
  /** Lines of standard error, told one per event after the start. */
  readonly lines?: readonly string[];
  /** It ends by itself after its lines with this exit. */
  readonly ends?: Partial<ProductionExit>;
  /** Standard output, told after the lines (a pre-check). */
  readonly output?: Uint8Array;
  readonly ignoresInputEnd?: boolean;
  /** After its lines, the door says this many lines were not handed on. */
  readonly dropped?: number;
}

interface Played extends ProductionProcess {
  readonly orders: string[];
  readonly call: DoorCall;
  endNow(exit?: Partial<ProductionExit>): void;
  /** Tells one more line, as the door would. */
  say(text: string): void;
}

interface DoorCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: ProductionProcessOptions['env'];
}

function scriptedDoor(script: (call: DoorCall, index: number) => Script): { door: ProductionDoor; guards: Played[] } {
  const guards: Played[] = [];
  const door: ProductionDoor = (options) => {
    if (options.command === PIPE_MAKER) return realDoor(options);
    const call: DoorCall = { command: options.command, args: [...options.args], env: options.env };
    const played = script(call, guards.length);
    let over = false;
    let finish: (exit: ProductionExit) => void = () => {};
    const ended = new Promise<ProductionExit>((resolveEnd) => {
      finish = (exit) => {
        if (over) return;
        over = true;
        resolveEnd(exit);
      };
    });
    const tell = (event: ProductionDiagnosticsEvent): void => {
      if (!over) options.onDiagnostics?.(event);
    };
    const orders: string[] = [];
    void (async () => {
      for (const text of played.lines ?? []) {
        await Promise.resolve();
        tell({ kind: 'line', text, cut: false });
      }
      if (played.dropped !== undefined) tell({ kind: 'dropped', lines: played.dropped });
      if (played.output !== undefined) options.onOutput?.(Buffer.from(played.output));
      if (played.ends !== undefined) {
        await Promise.resolve();
        finish(exitOf(played.ends));
      }
    })();
    const process: Played = {
      pid: 7000 + guards.length,
      started: Promise.resolve(),
      ended,
      orders,
      call,
      alive: () => !over,
      endInput() {
        orders.push('END_INPUT');
        if (played.ignoresInputEnd !== true) finish(exitOf({ exitCode: 255 }));
      },
      kill(signal) {
        orders.push(signal);
        finish(exitOf({ exitCode: null, signal }));
      },
      endNow: (exit = { exitCode: 1 }) => finish(exitOf(exit)),
      say: (text) => tell({ kind: 'line', text, cut: false }),
    };
    guards.push(process);
    return process;
  };
  return { door, guards };
}

/** A keeper that records what was asked of it. */
function recordingKeeper(): MacosPipeKeeper & { readonly log: string[] } {
  const log: string[] = [];
  return {
    log,
    async hold(path) {
      const name = path.slice(path.lastIndexOf('/') + 1);
      log.push(`hold ${name}`);
      return { drain: () => log.push(`drain ${name}`), release: () => log.push(`release ${name}`) };
    },
  };
}

// ── The rig ───────────────────────────────────────────────────────────────────────────────────

const root = realpathSync(mkdtempSync(join(tmpdir(), 'dems-n9-')));
afterAll(() => rmSync(root, { recursive: true, force: true }));
let cases = 0;
const uid = process.getuid?.() ?? 501;

interface Rig {
  readonly host: Host;
  readonly rows: Map<string, RegisteredAudioInput>;
  readonly door: ReturnType<typeof scriptedDoor>;
  readonly timers: ManualTimers;
  readonly keeper: ReturnType<typeof recordingKeeper>;
  readonly notices: MacosAudioNotice[];
  readonly lost: [string, UsbAudioError][];
  readonly adapter: UsbAudioMacosAdapter;
  readonly runDir: string;
}

function rig(devices: FixtureDevice[], rows: RegisteredAudioInput[], script: (call: DoorCall, index: number) => Script, over: Partial<UsbAudioMacosOptions> = {}, captureOrder?: string[]): Rig {
  const host = hostOf([...devices], captureOrder);
  const stored = new Map(rows.map((entry) => [entry.deviceId, entry]));
  const door = scriptedDoor(script);
  const timers = manualTimers();
  const keeper = recordingKeeper();
  const runDir = `${root}/case-${String((cases += 1))}/run/capture`;
  const notices: MacosAudioNotice[] = [];
  const lost: [string, UsbAudioError][] = [];
  const adapter = createUsbAudioMacosAdapter({
    devices: rows.map((entry) => entryOf(entry.deviceId)),
    registered: async (deviceId) => stored.get(deviceId) ?? null,
    cards: host.enumerator,
    helperProgram: HELPER,
    guardProgram: GUARD,
    runDir,
    timers,
    pipes: keeper,
    door: door.door,
    inspect: trustedInspector(uid),
    onNotice: (notice) => notices.push(notice),
    onSourceLost: (deviceId, error) => lost.push([deviceId, error]),
    ...over,
  });
  return { host, rows: stored, door, timers, keeper, notices, lost, adapter, runDir };
}

const target = (sessionId = 'SES-N9', signal: AbortSignal = new AbortController().signal): { sessionId: string; signal: AbortSignal } => ({ sessionId, signal });

async function until(condition: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 800 && !condition(); attempt += 1) await new Promise((resolveWait) => setTimeout(resolveWait, 5));
  if (!condition()) throw new Error(`timed out waiting for ${label}`);
}

/** Waits for a timer of this delay and fires it. */
async function fire(timers: ManualTimers, delayMs: number): Promise<void> {
  await until(() => timers.pending().includes(delayMs), `a timer of ${delayMs} ms`);
  timers.fire(delayMs);
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

/** The template, written out here word for word (SR-15 (2)): nothing of it is computed by the table under test. */
const HEAD = (index: number): string[] => ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-thread_queue_size', '1024', '-f', 'avfoundation', '-i', `none:${index}`];
const SECTION = (channel: number, pipe: string): string[] => ['-map', '0:a', '-af', `pan=mono|c0=c${channel}`, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'fifo', '-fifo_format', 'f32le', '-drop_pkts_on_overflow', '1', '-queue_size', '32', '-format_opts', 'flush_packets=1', '-y', pipe];
const PRECHECK = (index: number, channel: number): string[] => ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-f', 'avfoundation', '-i', `none:${index}`, '-t', '1', '-map', '0:a', '-af', `pan=mono|c0=c${channel}`, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-'];

/** Starts the handles and lets a passing launch through its settle time. */
async function startAll(r: Rig, streams: readonly UsbAudioMacosStream[]): Promise<unknown[]> {
  const outcomes = streams.map((stream) =>
    stream.start().then(
      () => null,
      (error: unknown) => error,
    ),
  );
  await Promise.race([until(() => r.timers.pending().includes(MACOS_AUDIO_LIMITS.settleMs), 'the settle timer'), Promise.all(outcomes)]);
  r.timers.fire(MACOS_AUDIO_LIMITS.settleMs);
  return Promise.all(outcomes);
}

/** A script whose helper prints the start of its launch (index and outputs read from its own vector). */
const passing = (patch: Partial<Script> = {}) => (call: DoorCall): Script => {
  const index = Number(/none:(\d+)/.exec(call.args.join(' '))?.[1] ?? '0');
  const outputs = call.args.filter((word) => word === '-map').length;
  return { lines: startOf(outputs, index), ...patch };
};

// ── 1. The open: one listing, the stored identity, no helper and no index kept ──────────────────

describe('open: the stored input found in a fresh listing; the group is joined; nothing starts', () => {
  it('one listing, a pipe of the gapped kind, no door call; the source facts state the bench form and the capture group', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1)], passing());
    const stream = await r.adapter.open('MIC-01', target());
    expect(r.host.lists()).toBe(1);
    expect(r.door.guards).toHaveLength(0);
    expect(stream.input).toEqual({ kind: 'PCM_FIFO_GAPPED', path: `${r.runDir}/SES-N9/MIC-01.pcm` });
    // MOVED BY ROW N10 (request line 553 (1)): the protocol's member and ITS statement of `mic-transport.ts`, no constant of this file.
    expect(MACOS_MIC_TRANSPORT).toBe(micTransportOf(CaptureMicInputKind.PCM_FIFO_GAPPED));
    expect(MACOS_MIC_TRANSPORT.kind).toBe('PCM_FIFO_GAPPED');
    // The gapped kind has no resampler: the worker follows no clock of the writer.
    expect(stream.transport).toBe(MACOS_MIC_TRANSPORT);
    expect(MACOS_MIC_TRANSPORT.clockCompensationPpm).toBe(0);
    expect(existsSync(stream.input.path)).toBe(true);
    expect(r.adapter.sourceFacts('MIC-01')).toEqual({
      product: 'DEMS Hexa 6',
      usbId: '1a2b:0006',
      usbSerial: null,
      usbPort: HEXA_PORT,
      cardId: `usb_${HEXA_PORT}`,
      cardDevice: 0,
      inputNumber: 1,
      nativeChannels: 6,
      sampleRateHz: 48_000,
      sampleBits: null,
      captureLayer: 'AVFOUNDATION',
      sampleContinuity: 'NOT_CONTINUOUS',
      captureGroup: 1,
    });
    expect([MACOS_CAPTURE_LAYER, MACOS_SAMPLE_CONTINUITY]).toEqual(['AVFOUNDATION', 'NOT_CONTINUOUS']);
    expect(r.adapter.groupOf('MIC-01')).toEqual({ captureGroup: 1, helperEnded: false });
    await stream.close();
    expect(existsSync(stream.input.path)).toBe(false);
    expect(r.adapter.sourceFacts('MIC-01')).toBeNull();
  });

  it('two inputs of one device are ONE group (both captureGroup 1); a second device of the session is group 2', async () => {
    const other: FixtureDevice = { name: 'DEMS Quad 4', vendor: 0x1a2b, product: 0x0004, location: 0x01130000, inputs: 4, rate: 48_000 };
    const r = rig([HEXA, other], [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 3), row('MIC-03', other, 1)], passing());
    const a = await r.adapter.open('MIC-01', target());
    const b = await r.adapter.open('MIC-02', target());
    expect([r.adapter.sourceFacts('MIC-01')?.captureGroup, r.adapter.sourceFacts('MIC-02')?.captureGroup]).toEqual([1, 1]);
    const c = await r.adapter.open('MIC-03', target('SES-N9b'));
    expect(r.adapter.sourceFacts('MIC-03')?.captureGroup).toBe(1);
    await c.close();
    const d = await r.adapter.open('MIC-03', target());
    expect(r.adapter.sourceFacts('MIC-03')?.captureGroup).toBe(2);
    await Promise.all([a.close(), b.close(), d.close()]);
  });

  it('refusals by name before a pipe or a helper exists: the rate the system states, an input beyond the device, absent, unregistered, an unreadable listing', async () => {
    const r = rig([{ ...HEXA, rate: 96_000 }], [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 7, { nativeChannels: 8 })], passing());
    const rate = await refusalOf(r.adapter.open('MIC-01', target()));
    expect([rate.code, rate.detail, rate.wireCode]).toEqual([UsbAudioRefusal.CARD_RATE_UNSUPPORTED, 'SYSTEM_STATES_OTHER_RATE', AudioInputErrorCode.OPEN_FAILED]);
    // Decision C118: the sentence tells the operator what to do, and that a restart can undo it.
    expect(rate.message).toBe(MACOS_AUDIO_SENTENCES.RATE);
    expect(rate.message).toMatch(/48,000 Hz in Audio MIDI Setup/);
    expect(rate).toBeInstanceOf(MacosUsbAudioError);
    r.host.devices = [HEXA];
    await expect(r.adapter.open('MIC-02', target())).rejects.toBeInstanceOf(AudioInputBeyondCardError);
    r.host.devices = [];
    r.host.captureOrder = [BUILT_IN];
    expect((await refusalOf(r.adapter.open('MIC-01', target()))).code).toBe(UsbAudioRefusal.CARD_ABSENT);
    r.host.failing = true;
    const failed = await refusalOf(r.adapter.open('MIC-01', target()));
    expect([failed.code, failed.detail]).toEqual([UsbAudioRefusal.LISTING_FAILED, 'ENDED_NONZERO']);
    await expect(r.adapter.open('MIC-09', target())).rejects.toBeInstanceOf(CaptureAdapterError);
    expect(r.door.guards).toHaveLength(0);
    expect(r.adapter.openSources()).toEqual([]);
  });

  it('THE UNDECIDED STATES (row N6\'s request): a connected device that cannot be tied is AMBIGUOUS with its reason - never ABSENT', async () => {
    const twin: FixtureDevice = { ...HEXA, product: 0x0007, location: 0x01140000 };
    const cases: [string, (host: Host) => void][] = [
      // Two units under one name: neither can be opened while both are connected (design 3.3).
      ['NAME_SHARED', (host) => {
        host.devices = [HEXA, twin];
        host.captureOrder = [BUILT_IN, HEXA.name, HEXA.name];
      }],
      // A confined Core: an empty system list is not "no microphone" (MF1, M9).
      ['NO_SYSTEM_INPUT', (host) => {
        host.confined = true;
        host.captureOrder = [];
      }],
      ['NO_CAPTURE_ENTRY', (host) => {
        host.devices = [{ ...HEXA, noCaptureEntry: true, noSystemItem: false }];
        host.captureOrder = [BUILT_IN, 'DEMS Other Input'];
      }],
      // The system list and the capture list name other sets of inputs: every device is undecided.
      ['LISTS_DISAGREE', (host) => {
        host.captureOrder = [BUILT_IN, HEXA.name, 'DEMS Virtual Input'];
      }],
    ];
    for (const [reason, change] of cases) {
      const r = rig([HEXA], [row('MIC-01', HEXA, 1)], passing());
      change(r.host);
      const refused = await refusalOf(r.adapter.open('MIC-01', target()));
      // Mutant M-1 (the undecided list not read): RED - CARD_ABSENT.
      expect([reason, refused.code, refused.detail]).toEqual([reason, UsbAudioRefusal.CARD_AMBIGUOUS, reason]);
      expect(r.door.guards).toHaveLength(0);
    }
  });

  // Task 4 row N10 (review SM-06): THE LOSS WATCH'S MATCH on `darwin` is the same rule as `open`'s, as a pure function of ONE tied
  // listing: present, absent, or AMBIGUOUS with the tie's reason - never ABSENT for a connected device that could not be tied.
  // Mutant (the undecided list not read, i.e. the Linux match alone): RED - the NAME_SHARED case answers CARD_ABSENT.
  it('row N10: the loss watch\'s match of one tied listing - found, absent, and the undecided device AMBIGUOUS with its reason', async () => {
    const watched = async (host: Host): Promise<MacosWatchedListing> => {
      const tied = await host.enumerator.listTied();
      if (!tied.ok) throw new Error('the fixture listing must be readable');
      return { ...tied.listing, undecided: tied.undecided };
    };
    const stored = row('MIC-01', HEXA, 1);
    const host = hostOf([HEXA]);
    expect(identifyMacosRegisteredCard(await watched(host), stored).ok).toBe(true);
    host.devices = [];
    host.captureOrder = [BUILT_IN];
    expect(identifyMacosRegisteredCard(await watched(host), stored)).toMatchObject({ ok: false, refusal: UsbAudioRefusal.CARD_ABSENT });
    host.devices = [HEXA, { ...HEXA, product: 0x0007, location: 0x01140000 }];
    host.captureOrder = [BUILT_IN, HEXA.name, HEXA.name];
    expect(identifyMacosRegisteredCard(await watched(host), stored)).toEqual({ ok: false, refusal: UsbAudioRefusal.CARD_AMBIGUOUS, detail: 'NAME_SHARED' });
  });
});

// ── 2. The one launch of a group ────────────────────────────────────────────────────────────────

describe('start: ONE launch per group, the device word from the listing of THIS launch', () => {
  it('two handles, two starts: ONE guarded helper with two sections in the order of the inputs, whatever the order of the opens', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 3)], passing());
    const standby = await r.adapter.open('MIC-02', target());
    const primary = await r.adapter.open('MIC-01', target());
    expect(await startAll(r, [standby, primary])).toEqual([null, null]);
    // Mutant M-2 (each start launches): RED - two guards.
    expect(r.door.guards).toHaveLength(1);
    const call = r.door.guards[0]?.call;
    expect(call?.command).toBe(GUARD);
    expect(call?.env).toEqual({});
    expect(call?.args).toEqual([HELPER, ...HEAD(1), ...SECTION(0, primary.input.path), ...SECTION(2, standby.input.path)]);
    // Open, launch (the second listing) and the third listing.
    expect(r.host.lists()).toBe(4);
    expect(r.keeper.log).toEqual(['hold MIC-01.pcm', 'hold MIC-02.pcm']);
    expect([primary.guardPid(), standby.guardPid()]).toEqual([7000, 7000]);
    expect(primary.started() && standby.started()).toBe(true);
    // A handle starts once.
    expect((await refusalOf(primary.start())).code).toBe(UsbAudioRefusal.ALREADY_OPEN);
    expect(r.adapter.launchReading('MIC-01')?.stream).toEqual({ known: true, format: 'PCM_F32LE_FLT', rateHz: 48_000, layout: { kind: 'NAMED', word: '5.1', channels: 6, basis: 'MEASURED' } });
    expect(r.adapter.launchReading('MIC-01')?.outputs).toHaveLength(2);
    await Promise.all([primary.close(), standby.close()]);
  });

  it('AN INDEX IS VALID FOR ONE START (C118 (3)): the device moved from index 1 at the open to index 0 at the launch - `none:0` is the word', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1)], passing());
    const stream = await r.adapter.open('MIC-01', target());
    // Between the open and the start the capture program's list puts the interface first (rows MM, N6, N4b: 0, 1, 2 in two days).
    r.host.captureOrder = [HEXA.name, BUILT_IN];
    expect(await startAll(r, [stream])).toEqual([null]);
    // Mutant M-3 (the index of the open kept): RED - `none:1`.
    expect(r.door.guards[0]?.call.args.slice(1, 12)).toEqual(HEAD(0));
    await stream.close();
  });

  it('SM-34 (6): a handle opened after the launch is refused, with the sentence that it joins at the next start', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 3)], passing());
    const primary = await r.adapter.open('MIC-01', target());
    expect(await startAll(r, [primary])).toEqual([null]);
    const late = await refusalOf(r.adapter.open('MIC-02', target()));
    expect([late.code, late.detail, late.wireCode]).toEqual([UsbAudioRefusal.ALREADY_OPEN, 'DEVICE_HELPER_RUNNING', AudioInputErrorCode.DEVICE_BUSY]);
    expect(late.message).toBe(MACOS_AUDIO_SENTENCES.JOINS_LATER);
    // A pre-check of the device beside the running helper is refused the same way (two helpers cannot hold one device, MF13).
    const beside = await r.adapter.precheck('MIC-02');
    expect([beside?.code, (beside as UsbAudioError | null)?.detail]).toEqual([UsbAudioRefusal.ALREADY_OPEN, 'DEVICE_HELPER_RUNNING']);
    expect(r.door.guards).toHaveLength(1);
    await primary.close();
  });

  it('THE GATE refuses a helper that states 96,000 Hz (the system said 48,000): every microphone of the launch fails with the rate\'s sentence, and the helper is stopped', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 3)], (call) => ({ lines: startOf(2, Number(/none:(\d+)/.exec(call.args.join(' '))?.[1])) .map((line) => line.replace('48000 Hz, 5.1,', '96000 Hz, 5.1,')) }));
    const a = await r.adapter.open('MIC-01', target());
    const b = await r.adapter.open('MIC-02', target());
    const [ea, eb] = (await Promise.all([refusalOf(a.start()), refusalOf(b.start())])) as [UsbAudioError, UsbAudioError];
    expect([ea.code, ea.detail, ea.deviceId, eb.code, eb.deviceId]).toEqual([UsbAudioRefusal.CARD_RATE_UNSUPPORTED, 'HELPER_STATES_OTHER_RATE', 'MIC-01', UsbAudioRefusal.CARD_RATE_UNSUPPORTED, 'MIC-02']);
    expect(ea.message).toBe(MACOS_AUDIO_SENTENCES.RATE);
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT']);
    expect(r.keeper.log).toEqual(['hold MIC-01.pcm', 'hold MIC-02.pcm', 'release MIC-01.pcm', 'release MIC-02.pcm']);
    expect(r.adapter.groupOf('MIC-01')?.helperEnded).toBe(true);
    await Promise.all([a.close(), b.close()]);
    expect(existsSync(a.input.path) || existsSync(b.input.path)).toBe(false);
  });

  it('no stream line within 3,000 ms: stopped, NO_STREAM_LINE; lines dropped by the door before the verdict: LINES_DROPPED', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1)], () => ({ lines: [] }));
    const stream = await r.adapter.open('MIC-01', target());
    const outcome = refusalOf(stream.start());
    await fire(r.timers, MACOS_AUDIO_LIMITS.streamLineMs);
    const refused = await outcome;
    expect([refused.code, refused.detail]).toEqual([UsbAudioRefusal.HELPER_ENDED_AT_START, 'NO_STREAM_LINE']);
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT']);
    await stream.close();

    // The door's bounds dropped lines before the gate had read the start: a dropped line may have been a second statement.
    const d = rig([HEXA], [row('MIC-01', HEXA, 1)], () => ({ lines: startOf(1, 1).slice(0, 3), dropped: 2 }));
    const dropped = await d.adapter.open('MIC-01', target());
    const late = await refusalOf(dropped.start());
    // Mutant M-9 (a `dropped` event before the verdict ignored): RED - the start then passes on what was left.
    expect([late.code, late.detail]).toEqual([UsbAudioRefusal.HELPER_ENDED_AT_START, 'LINES_DROPPED']);
    expect(d.door.guards[0]?.orders).toEqual(['END_INPUT']);
    await dropped.close();
  });

  it('the THIRD listing is not the second (another input appeared, the order moved): CARD_MOVED / LIST_CHANGED, the helper stopped', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1)], passing());
    const stream = await r.adapter.open('MIC-01', target());
    const outcome = stream.start().then(
      () => null,
      (error: unknown) => error as UsbAudioError,
    );
    await until(() => r.timers.pending().includes(MACOS_AUDIO_LIMITS.settleMs), 'the settle timer');
    r.host.captureOrder = [HEXA.name, BUILT_IN];
    r.timers.fire(MACOS_AUDIO_LIMITS.settleMs);
    const refused = await outcome;
    expect([refused?.code, refused?.detail]).toEqual([UsbAudioRefusal.CARD_MOVED, 'LIST_CHANGED']);
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT']);
    await stream.close();
  });
});

// ── 3. The pause and the one retry (design 4.7; SM-39) ─────────────────────────────────────────

describe('unreliable opens: the pause of 1,000 ms after an end, kept PER DEVICE, and ONE retry', () => {
  it('a refused open (status 251, the fixed line, no stream): the notice, the pause, a FRESH listing and a new index; the second launch passes', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 3)], (call, index) => (index === 0 ? { lines: REFUSED_OPEN, ends: { exitCode: 251 } } : passing()(call)));
    const a = await r.adapter.open('MIC-01', target());
    const b = await r.adapter.open('MIC-02', target());
    const outcomes = [a, b].map((stream) =>
      stream.start().then(
        () => null,
        (error: unknown) => error,
      ),
    );
    await until(() => r.notices.length === 2, 'the retry notices');
    expect(r.notices).toEqual([
      { code: MacosAudioNoticeCode.OPEN_RETRIED, deviceId: 'MIC-01' },
      { code: MacosAudioNoticeCode.OPEN_RETRIED, deviceId: 'MIC-02' },
    ]);
    // The pause: no second helper before the 1,000 ms of the device have passed. Mutant M-4 (no pause): RED - the guard starts at once.
    await until(() => r.timers.pending().includes(MACOS_AUDIO_LIMITS.pauseMs), 'the pause');
    expect(r.door.guards).toHaveLength(1);
    const listsBefore = r.host.lists();
    r.host.captureOrder = [HEXA.name, BUILT_IN];
    r.timers.fire(MACOS_AUDIO_LIMITS.pauseMs);
    await until(() => r.timers.pending().includes(MACOS_AUDIO_LIMITS.settleMs), 'the settle timer');
    r.timers.fire(MACOS_AUDIO_LIMITS.settleMs);
    expect(await Promise.all(outcomes)).toEqual([null, null]);
    expect(r.door.guards).toHaveLength(2);
    // The retry's own listing gave the word: index 0 now. Mutant M-5 (the first listing's index reused): RED.
    expect(r.door.guards[1]?.call.args.slice(1, 12)).toEqual(HEAD(0));
    expect(r.host.lists() - listsBefore).toBe(2);
    await Promise.all([a.close(), b.close()]);
  });

  it('refused twice: FORMAT_NOT_SUPPORTED, no third launch; an early end of another kind is NOT retried', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1)], () => ({ lines: REFUSED_OPEN, ends: { exitCode: 251 } }));
    const stream = await r.adapter.open('MIC-01', target());
    const outcome = refusalOf(stream.start());
    await fire(r.timers, MACOS_AUDIO_LIMITS.pauseMs);
    const refused = await outcome;
    // Mutant M-6 (`attempt === 1` dropped from the retry's condition): RED - the loop never ends.
    expect([refused.code, refused.detail]).toEqual([UsbAudioRefusal.HELPER_ENDED_AT_START, 'FORMAT_NOT_SUPPORTED']);
    expect(r.door.guards).toHaveLength(2);
    await stream.close();

    const other = rig([HEXA], [row('MIC-01', HEXA, 1)], () => ({ lines: REFUSED_OPEN, ends: { exitCode: 1 } }));
    const once = await other.adapter.open('MIC-01', target());
    const ended = await refusalOf(once.start());
    expect([ended.code, ended.detail, other.door.guards.length, other.notices]).toEqual([UsbAudioRefusal.HELPER_ENDED_AT_START, 'EXIT_1', 1, []]);
    await once.close();
  });

  it('the pause holds across a pre-check and the session start that follows it, on the same device (SM-39 (5))', async () => {
    const signal = new Float32Array(48_000).fill(0.125);
    const r = rig([HEXA], [row('MIC-01', HEXA, 1)], (call, index) => (index === 0 ? { lines: startOf(1, 1), output: new Uint8Array(signal.buffer), ends: { exitCode: 0 } } : passing()(call)));
    expect(await r.adapter.precheck('MIC-01')).toBeNull();
    expect(r.door.guards[0]?.call.args).toEqual([HELPER, ...PRECHECK(1, 0)]);
    const stream = await r.adapter.open('MIC-01', target());
    const outcome = stream.start().then(
      () => null,
      (error: unknown) => error,
    );
    await until(() => r.timers.pending().includes(MACOS_AUDIO_LIMITS.pauseMs), 'the pause');
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    expect(r.door.guards).toHaveLength(1);
    r.timers.fire(MACOS_AUDIO_LIMITS.pauseMs);
    await fire(r.timers, MACOS_AUDIO_LIMITS.settleMs);
    expect(await outcome).toBeNull();
    expect(r.door.guards).toHaveLength(2);
    await stream.close();
  });
});

// ── 4. Close, end, loss ─────────────────────────────────────────────────────────────────────────

describe('close of one handle, the end of a group, the helper\'s own end, the queue lines', () => {
  it('CLOSE OF ONE while the other records: its pipe stays and is DRAINED by the adapter; the helper is not stopped; the last close stops it, lets the readers go, removes both pipes', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 3)], passing());
    const a = await r.adapter.open('MIC-01', target());
    const b = await r.adapter.open('MIC-02', target());
    expect(await startAll(r, [a, b])).toEqual([null, null]);
    await b.close();
    // Mutant M-7 (`release` in the place of `drain`): RED - the pipe's last reader would be gone and the helper ends with 224 (block 6 shows it on a process).
    expect(r.keeper.log).toEqual(['hold MIC-01.pcm', 'hold MIC-02.pcm', 'drain MIC-02.pcm']);
    expect(existsSync(b.input.path)).toBe(true);
    expect(r.door.guards[0]?.orders).toEqual([]);
    expect(r.adapter.openSources()).toEqual(['MIC-01']);
    expect(r.adapter.sourceFacts('MIC-02')).toBeNull();
    await a.close();
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT']);
    expect(r.keeper.log.slice(3)).toEqual(['release MIC-01.pcm', 'release MIC-02.pcm']);
    expect(existsSync(a.input.path) || existsSync(b.input.path)).toBe(false);
    // The ordered end (255 after the adapter's own stop) is no loss.
    expect(r.lost).toEqual([]);
  });

  it('THE HELPER\'S OWN END tells EVERY live handle once, both in the same instant; the group then refuses the switch with what is true', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 3)], passing());
    const a = await r.adapter.open('MIC-01', target());
    const b = await r.adapter.open('MIC-02', target());
    expect(await startAll(r, [a, b])).toEqual([null, null]);
    r.door.guards[0]?.endNow({ exitCode: 1 });
    await until(() => r.lost.length === 2, 'both told');
    expect(r.lost.map(([deviceId, error]) => [deviceId, error.code, error.detail])).toEqual([
      ['MIC-01', UsbAudioRefusal.HELPER_EXITED, 'EXIT_1'],
      ['MIC-02', UsbAudioRefusal.HELPER_EXITED, 'EXIT_1'],
    ]);
    expect(r.adapter.groupOf('MIC-02')).toEqual({ captureGroup: 1, helperEnded: true });
    expect(MACOS_AUDIO_SENTENCES.GROUP_ENDED).toMatch(/the second channel cannot bring the audio back/);
    await Promise.all([a.close(), b.close()]);
    expect(r.lost).toHaveLength(2);
  });

  it('the queue lines are notices of every microphone of the group; `full` without `flushed` in 10,000 ms is a fault of the group (SM-35 (4))', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 3)], passing());
    const a = await r.adapter.open('MIC-01', target());
    const b = await r.adapter.open('MIC-02', target());
    expect(await startAll(r, [a, b])).toEqual([null, null]);
    const guard = r.door.guards[0];
    guard?.say(QUEUE[0] ?? '');
    guard?.say(QUEUE[1] ?? '');
    expect(r.notices.map((notice) => `${notice.code} ${notice.deviceId}`)).toEqual([
      'CAPTURE_MIC_HELPER_QUEUE_FULL MIC-01',
      'CAPTURE_MIC_HELPER_QUEUE_FULL MIC-02',
      'CAPTURE_MIC_HELPER_QUEUE_FLUSHED MIC-01',
      'CAPTURE_MIC_HELPER_QUEUE_FLUSHED MIC-02',
    ]);
    expect(r.timers.pending()).not.toContain(MACOS_AUDIO_LIMITS.queueFlushMs);
    guard?.say(QUEUE[0] ?? '');
    r.timers.fire(MACOS_AUDIO_LIMITS.queueFlushMs);
    expect(r.lost.map(([deviceId, error]) => [deviceId, error.code, error.detail])).toEqual([
      ['MIC-01', UsbAudioRefusal.NO_SAMPLE, 'QUEUE_NOT_FLUSHED'],
      ['MIC-02', UsbAudioRefusal.NO_SAMPLE, 'QUEUE_NOT_FLUSHED'],
    ]);
    expect(r.notices.slice(-2).map((notice) => notice.code)).toEqual(['CAPTURE_MIC_HELPER_QUEUE_NOT_FLUSHED', 'CAPTURE_MIC_HELPER_QUEUE_NOT_FLUSHED']);
    await Promise.all([a.close(), b.close()]);
  });

  it('a guard that does not end on its input is signalled only past its own escalation: SIGTERM at 3,000 ms, SIGKILL at 5,000 ms', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1)], passing({ ignoresInputEnd: true }));
    const stream = await r.adapter.open('MIC-01', target());
    expect(await startAll(r, [stream])).toEqual([null]);
    const closing = stream.close();
    await until(() => r.timers.pending().includes(MACOS_AUDIO_LIMITS.stopGraceMs), 'the stop timers');
    expect(r.timers.pending()).toContain(MACOS_AUDIO_LIMITS.stopGraceMs + MACOS_AUDIO_LIMITS.killGraceMs);
    expect(MACOS_AUDIO_LIMITS.stopGraceMs).toBeGreaterThan(2_000);
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT']);
    r.timers.fire(MACOS_AUDIO_LIMITS.stopGraceMs);
    await closing;
    expect(r.door.guards[0]?.orders).toEqual(['END_INPUT', 'SIGTERM']);
    expect(r.notices).toEqual([{ code: MacosAudioNoticeCode.HELPER_SIGNALLED, deviceId: 'MIC-01' }]);
  });
});

// ── 5. Pre-check, enumerate, the later device ─────────────────────────────────────────────────────

describe('pre-check, enumerate, admitDevice', () => {
  const precheckWith = (samples: Float32Array, patch: Partial<Script> = {}) => (): Script => ({ lines: startOf(1, 1), output: new Uint8Array(samples.buffer), ends: { exitCode: 0 }, ...patch });

  it('one non-zero sample passes; a silent second is INPUT_SILENT (the start table makes a silent PRIMARY block and a silent STANDBY warn); no sample is NO_SAMPLE', async () => {
    const live = new Float32Array(43_000);
    live[42_999] = 1e-6;
    expect(await rig([HEXA], [row('MIC-01', HEXA, 1)], precheckWith(live)).adapter.precheck('MIC-01')).toBeNull();
    const silent = await rig([HEXA], [row('MIC-01', HEXA, 1)], precheckWith(new Float32Array(43_000))).adapter.precheck('MIC-01');
    // Mutant M-8 (the silent test dropped): RED - null.
    expect([silent?.code, (silent as UsbAudioError).detail, (silent as UsbAudioError).wireCode]).toEqual([UsbAudioRefusal.HELPER_ENDED_AT_START, 'INPUT_SILENT', AudioInputErrorCode.OPEN_FAILED]);
    const none = await rig([HEXA], [row('MIC-01', HEXA, 1)], precheckWith(new Float32Array(0))).adapter.precheck('MIC-01');
    expect((none as UsbAudioError).detail).toBe('NO_SAMPLE');
    // The pre-check is gated too: a helper that states 96,000 Hz is refused whatever it delivered.
    const fast = await rig([HEXA], [row('MIC-01', HEXA, 1)], precheckWith(live, { lines: startOf(1, 1, 96_000) })).adapter.precheck('MIC-01');
    expect([fast?.code, (fast as UsbAudioError).detail]).toEqual([UsbAudioRefusal.CARD_RATE_UNSUPPORTED, 'HELPER_STATES_OTHER_RATE']);
  });

  it('enumerate: one listing, present / not present by the wire vocabulary; nothing starts', async () => {
    // R-FLEX row 107 (D10 ruling 1, no port lock): a serial-less unit of the same model on another socket IS the
    // stored card, so the not-present row is another model (another USB id), not another socket.
    const r = rig([HEXA], [row('MIC-01', HEXA, 1), row('MIC-02', { ...HEXA, product: 0x0016, location: 0x01150000 }, 1)], passing());
    expect(await r.adapter.enumerate()).toEqual([
      { inputId: 'MIC-01', present: true, errorCode: null },
      { inputId: 'MIC-02', present: false, errorCode: AudioInputErrorCode.DEVICE_NOT_FOUND },
    ]);
    expect(r.host.lists()).toBe(1);
    expect(r.door.guards).toHaveLength(0);
    expect(r.adapter.kind).toBe(CaptureAdapterKind.USB_AUDIO);
    expect(r.adapter.hasOpener).toBe(true);
  });

  it('admitDevice: a later microphone is served by its stored identity; a camera entry is refused', async () => {
    const r = rig([HEXA], [row('MIC-01', HEXA, 1)], passing());
    r.rows.set('MIC-04', row('MIC-04', HEXA, 2));
    r.adapter.admitDevice(entryOf('MIC-04'));
    expect(r.adapter.admittedDevices().map((entry) => entry.id)).toEqual(['MIC-04']);
    expect(() => r.adapter.admitDevice({ id: 'CAM-01', deviceClass: 'CAMERA', label: 'x', capabilities: ['VIDEO'], profiles: [] } as unknown as CaptureDeviceEntry)).toThrow(CaptureAdapterError);
    const stream = await r.adapter.open('MIC-04', target());
    expect(stream.inputNumber).toBe(2);
    await stream.close();
  });
});

// ── 6. Real processes: a stand-in guard, a stand-in helper, real named pipes ────────────────────

const STAND_IN_GUARD = `#!${process.execPath}
// A stand-in for the guard of row 23: starts its first argument with the rest, its standard input
// not handed on; on the end of its own input (or SIGTERM) it sends SIGTERM to the child and, after
// 2,000 ms (the built guard's GUARD_TERM_BOUND_MS), SIGKILL; it passes the child's exit on.
const { spawn } = require('node:child_process');
const [program, ...rest] = process.argv.slice(2);
const child = spawn(program, rest, { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
let ending = false;
const end = () => {
  if (ending) return;
  ending = true;
  child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 2000).unref();
};
process.stdin.on('end', end);
process.stdin.on('close', end);
process.stdin.resume();
process.on('SIGTERM', end);
child.on('error', () => process.exit(126));
child.on('exit', (code, signal) => process.exit(code === null ? 128 + (signal === 'SIGKILL' ? 9 : 15) : code));
`;

const STAND_IN_HELPER = `#!${process.execPath}
// A stand-in for the pinned helper on macOS. Its argument list must BE the template of SR-15 word
// for word (else status 64). Its behaviour comes from the fixture file mode.json beside it, never
// from an argument. It prints the recorded start lines, then writes 32-bit float into each pipe
// (O_NONBLOCK: a full pipe drops, as the dropping queue does); when the last reader of a pipe is
// gone the write fails and it ends with 224, as the pinned helper did (row N4b).
const fs = require('node:fs');
const path = require('node:path');
const dir = path.dirname(process.argv[1]);
const mode = JSON.parse(fs.readFileSync(path.join(dir, 'mode.json'), 'utf8'));
const argv = process.argv.slice(2);
const fail = (status) => process.exit(status);
const HEAD = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-thread_queue_size', '1024', '-f', 'avfoundation', '-i'];
const SEC = ['-map', '0:a', '-af', null, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'fifo', '-fifo_format', 'f32le', '-drop_pkts_on_overflow', '1', '-queue_size', '32', '-format_opts', 'flush_packets=1', '-y', null];
const PRE = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-f', 'avfoundation', '-i', null, '-t', '1', '-map', '0:a', '-af', null, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-'];
const WORD = /^none:(0|[1-9][0-9]?)$/;
const SELECT = /^pan=mono\\|c0=c([0-9]{1,2})$/;
const like = (words, form) => words.length === form.length && form.every((word, at) => word === null || word === words[at]);
let precheck = false; let index = -1; const outputs = [];
if (like(argv, PRE)) {
  precheck = true;
  if (!WORD.test(argv[8]) || !SELECT.test(argv[14])) fail(64);
  index = Number(argv[8].slice(5));
  outputs.push({ channel: Number(SELECT.exec(argv[14])[1]), pipe: null });
} else {
  if (!like(argv.slice(0, 10), HEAD) || !WORD.test(argv[10] || '')) fail(64);
  index = Number(argv[10].slice(5));
  const rest = argv.slice(11);
  if (rest.length !== 22 && rest.length !== 44) fail(64);
  for (let at = 0; at < rest.length; at += 22) {
    const section = rest.slice(at, at + 22);
    if (!like(section, SEC) || !SELECT.test(section[3]) || !section[21].startsWith('/')) fail(64);
    outputs.push({ channel: Number(SELECT.exec(section[3])[1]), pipe: section[21] });
  }
}
fs.appendFileSync(path.join(dir, 'pids.log'), String(process.pid) + '\\n');
const counter = path.join(dir, 'refused.count');
const refused = fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0;
if (refused < (mode.refuseOpens || 0)) {
  fs.writeFileSync(counter, String(refused + 1));
  process.stderr.write(fs.readFileSync(path.join(dir, 'refused.txt'), 'utf8'));
  process.exit(251);
}
if (mode.ignoreTerm) process.on('SIGTERM', () => {});
else process.on('SIGTERM', () => { process.stderr.write('Exiting normally, received signal 15.\\n'); process.exit(255); });
const start = fs.readFileSync(path.join(dir, outputs.length === 2 ? 'start-2.txt' : 'start-1.txt'), 'utf8')
  .replace("'none:0'", "'none:" + index + "'")
  .replace('48000 Hz, 5.1,', (mode.rate || 48000) + ' Hz, 5.1,');
process.stderr.write(start);
const value = (channel) => (mode.silent ? 0 : (channel + 1) / 16);
if (precheck) {
  const out = Buffer.alloc(48000 * 4);
  for (let at = 0; at < 48000; at += 1) out.writeFloatLE(value(outputs[0].channel), at * 4);
  process.stdout.write(out, () => process.exit(0));
} else {
  const fds = outputs.map((output) => fs.openSync(output.pipe, fs.constants.O_WRONLY | fs.constants.O_NONBLOCK));
  const blocks = outputs.map((output) => { const block = Buffer.alloc(480 * 4); for (let at = 0; at < 480; at += 1) block.writeFloatLE(value(output.channel), at * 4); return block; });
  setInterval(() => {
    fds.forEach((fd, at) => {
      try { fs.writeSync(fd, blocks[at]); } catch (error) {
        if (error.code === 'EPIPE') { process.stderr.write('Conversion failed!\\n'); process.exit(224); }
      }
    });
  }, 10);
}
`;

describe('real processes through the real production door: the stand-in guard and helper, real named pipes', () => {
  const bin = `${root}/bin`;
  const guard = `${bin}/stand-in-guard`;
  const helper = `${bin}/stand-in-helper`;
  const inspect = (path: string): ProgramFacts => (path === guard || path === helper ? trustedInspector(uid)() : inspectProgram(path));
  const setMode = (mode: Record<string, unknown>): void => {
    if (!existsSync(guard)) {
      // Made once, below the temporary root: executable by the owner only.
      mkdirSync(bin, { recursive: true, mode: 0o700 });
      writeFileSync(guard, STAND_IN_GUARD, { mode: 0o700 });
      writeFileSync(helper, STAND_IN_HELPER, { mode: 0o700 });
      writeFileSync(`${bin}/start-2.txt`, `${TWO_OUTPUTS.join('\n')}\n`);
      writeFileSync(`${bin}/start-1.txt`, `${ONE_OUTPUT.join('\n')}\n`);
      writeFileSync(`${bin}/refused.txt`, `${REFUSED_OPEN.join('\n')}\n`);
    }
    writeFileSync(`${bin}/mode.json`, JSON.stringify(mode));
    rmSync(`${bin}/refused.count`, { force: true });
    rmSync(`${bin}/pids.log`, { force: true });
  };
  const pids = (): number[] => (existsSync(`${bin}/pids.log`) ? readFileSync(`${bin}/pids.log`, 'utf8').split('\n').filter((line) => line !== '').map(Number) : []);
  const alive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  /** The test's keeper: a real reader on the pipe, idle until drained. */
  const fsKeeper = (): MacosPipeKeeper & { drained: () => number; holding: () => number } => {
    let drained = 0;
    let holding = 0;
    return {
      drained: () => drained,
      holding: () => holding,
      async hold(path) {
        const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
        holding += 1;
        let timer: ReturnType<typeof setInterval> | null = null;
        let open = true;
        const held: MacosHeldPipe = {
          drain() {
            timer ??= setInterval(() => {
              const scratch = Buffer.alloc(65_536);
              try {
                drained += readSync(fd, scratch, 0, scratch.length, null);
              } catch {
                // EAGAIN: nothing waits.
              }
            }, 5);
          },
          release() {
            if (timer !== null) clearInterval(timer);
            if (open) {
              open = false;
              holding -= 1;
              closeSync(fd);
            }
          },
        };
        return held;
      },
    };
  };
  /** A keeper that holds nothing: the CONTROL of C118 (1). */
  const noKeeper: MacosPipeKeeper = { hold: async () => ({ drain: () => {}, release: () => {} }) };

  const live = (pipes: MacosPipeKeeper, rows: RegisteredAudioInput[] = [row('MIC-01', HEXA, 1), row('MIC-02', HEXA, 3)]): { adapter: UsbAudioMacosAdapter; lost: [string, UsbAudioError][]; notices: MacosAudioNotice[]; host: Host } => {
    const host = hostOf([HEXA]);
    const lost: [string, UsbAudioError][] = [];
    const notices: MacosAudioNotice[] = [];
    const adapter = createUsbAudioMacosAdapter({
      devices: rows.map((entry) => entryOf(entry.deviceId)),
      registered: async (deviceId) => rows.find((entry) => entry.deviceId === deviceId) ?? null,
      cards: host.enumerator,
      helperProgram: helper,
      guardProgram: guard,
      runDir: `${root}/case-${String((cases += 1))}/run/capture`,
      timers: createSystemTimers(),
      pipes,
      door: realDoor,
      inspect,
      onSourceLost: (deviceId, error) => lost.push([deviceId, error]),
      onNotice: (notice) => notices.push(notice),
    });
    return { adapter, lost, notices, host };
  };

  /** The worker's reader of one pipe. */
  const reader = (path: string): { read(): Float32Array; close(): void } => {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
    return {
      read() {
        const out = Buffer.alloc(65_536);
        let got = 0;
        try {
          got = readSync(fd, out, 0, out.length, null);
        } catch {
          got = 0;
        }
        const whole = got - (got % 4);
        return Float32Array.from({ length: whole / 4 }, (_unused, at) => out.readFloatLE(at * 4));
      },
      close: () => closeSync(fd),
    };
  };
  const pause = (ms: number): Promise<void> => new Promise((resolveWait) => setTimeout(resolveWait, ms));
  const fast = (stream: UsbAudioMacosStream): Promise<void> => stream.start();

  it('ONE GROUP, TWO HANDLES, ONE HELPER: each pipe carries its own channel; CLOSE OF ONE while the other records - its pipe drained, the helper lives; the last close leaves no process', async () => {
    setMode({});
    const keeper = fsKeeper();
    const r = live(keeper);
    const a = await r.adapter.open('MIC-01', target());
    const b = await r.adapter.open('MIC-02', target());
    const pa = reader(a.input.path);
    const pb = reader(b.input.path);
    await Promise.all([fast(a), fast(b)]);
    expect(pids()).toHaveLength(1);
    await pause(150);
    const heardA = pa.read();
    const heardB = pb.read();
    expect(heardA.length).toBeGreaterThan(0);
    expect(heardB.length).toBeGreaterThan(0);
    // Input 1 is channel 0, input 3 is channel 2: the stand-in writes (channel + 1) / 16.
    expect(heardA.every((value) => value === 1 / 16)).toBe(true);
    expect(heardB.every((value) => value === 3 / 16)).toBe(true);
    // The STANDBY's handle is closed, and the worker's reader of its pipe goes too.
    await b.close();
    pb.close();
    await pause(300);
    expect(pids().filter(alive)).toHaveLength(1);
    expect(a.guardPid() !== null && alive(a.guardPid() ?? -1)).toBe(true);
    expect(pa.read().length).toBeGreaterThan(0);
    expect(keeper.drained()).toBeGreaterThan(0);
    expect(existsSync(b.input.path)).toBe(true);
    expect(r.lost).toEqual([]);
    await a.close();
    pa.close();
    expect(pids().filter(alive)).toEqual([]);
    expect(keeper.holding()).toBe(0);
    expect(existsSync(a.input.path) || existsSync(b.input.path)).toBe(false);
    expect(r.adapter.livePids().size).toBe(0);
  }, 30_000);

  it('CONTROL of C118 (1): without the adapter\'s reader, the worker closing the STANDBY\'s pipe ends the WHOLE helper (224) and the PRIMARY is lost', async () => {
    setMode({});
    const r = live(noKeeper);
    const a = await r.adapter.open('MIC-01', target());
    const b = await r.adapter.open('MIC-02', target());
    const pa = reader(a.input.path);
    const pb = reader(b.input.path);
    await Promise.all([fast(a), fast(b)]);
    await b.close();
    pb.close();
    await until(() => r.lost.length === 1, 'the loss of the primary');
    expect(r.lost.map(([deviceId, error]) => [deviceId, error.code, error.detail])).toEqual([['MIC-01', UsbAudioRefusal.HELPER_EXITED, 'EXIT_224']]);
    await a.close();
    pa.close();
    expect(pids().filter(alive)).toEqual([]);
  }, 30_000);

  it('THE RATE GATE on a process: a helper that states 96,000 Hz is refused, stopped, and leaves no process', async () => {
    setMode({ rate: 96_000 });
    const r = live(fsKeeper(), [row('MIC-01', HEXA, 1)]);
    const a = await r.adapter.open('MIC-01', target());
    const pa = reader(a.input.path);
    const refused = await refusalOf(a.start());
    expect([refused.code, refused.detail, refused.message]).toEqual([UsbAudioRefusal.CARD_RATE_UNSUPPORTED, 'HELPER_STATES_OTHER_RATE', MACOS_AUDIO_SENTENCES.RATE]);
    expect(pids()).toHaveLength(1);
    expect(pids().filter(alive)).toEqual([]);
    await a.close();
    pa.close();
  }, 30_000);

  it('A REFUSED OPEN and its ONE retry after the pause, timed: under the 8,000 ms of a microphone start; refused twice is FORMAT_NOT_SUPPORTED', async () => {
    setMode({ refuseOpens: 1 });
    const r = live(fsKeeper(), [row('MIC-01', HEXA, 1)]);
    const a = await r.adapter.open('MIC-01', target());
    const pa = reader(a.input.path);
    const began = performance.now();
    await a.start();
    const took = performance.now() - began;
    // The pause (1,000 ms) and the settle time (1,500 ms) at least; far under the session's bound.
    expect(took).toBeGreaterThanOrEqual(2_400);
    expect(took).toBeLessThan(8_000);
    expect(r.notices).toEqual([{ code: MacosAudioNoticeCode.OPEN_RETRIED, deviceId: 'MIC-01' }]);
    expect(pids()).toHaveLength(2);
    await a.close();
    pa.close();

    setMode({ refuseOpens: 2 });
    const twice = live(fsKeeper(), [row('MIC-01', HEXA, 1)]);
    const b = await twice.adapter.open('MIC-01', target());
    const refused = await refusalOf(b.start());
    expect([refused.code, refused.detail]).toEqual([UsbAudioRefusal.HELPER_ENDED_AT_START, 'FORMAT_NOT_SUPPORTED']);
    expect(pids()).toHaveLength(2);
    await b.close();
    expect(pids().filter(alive)).toEqual([]);
  }, 30_000);

  it('A HELPER THAT IGNORES SIGTERM (a pipe no worker opened, C118 (2)): a start that fails before the worker reads leaves NO process - SIGKILL within the guard\'s bound', async () => {
    setMode({ rate: 96_000, ignoreTerm: true });
    const r = live(fsKeeper(), [row('MIC-01', HEXA, 1)]);
    const a = await r.adapter.open('MIC-01', target());
    // No worker reader on the pipe at all.
    const began = performance.now();
    const refused = await refusalOf(a.start());
    const took = performance.now() - began;
    expect(refused.code).toBe(UsbAudioRefusal.CARD_RATE_UNSUPPORTED);
    // Proof: the helper's process is gone the moment the start has failed; the guard's SIGKILL came after its 2,000 ms.
    const [helperPid] = pids();
    expect(helperPid).toBeDefined();
    expect(alive(helperPid ?? -1)).toBe(false);
    expect(took).toBeGreaterThanOrEqual(1_900);
    expect(took).toBeLessThan(MACOS_AUDIO_LIMITS.stopGraceMs + MACOS_AUDIO_LIMITS.killGraceMs);
    // The guard did it: the adapter did not have to signal the guard.
    expect(r.notices).toEqual([]);
    await a.close();
    expect(pids().filter(alive)).toEqual([]);
  }, 30_000);

  it('the pre-check runs for real: one second counted in memory and dropped; a silent input is INPUT_SILENT', async () => {
    setMode({});
    expect(await live(fsKeeper(), [row('MIC-01', HEXA, 1)]).adapter.precheck('MIC-01')).toBeNull();
    setMode({ silent: true });
    const silent = await live(fsKeeper(), [row('MIC-01', HEXA, 1)]).adapter.precheck('MIC-01');
    expect([silent?.code, (silent as UsbAudioError).detail]).toEqual([UsbAudioRefusal.HELPER_ENDED_AT_START, 'INPUT_SILENT']);
    expect(pids().filter(alive)).toEqual([]);
  }, 30_000);
});
