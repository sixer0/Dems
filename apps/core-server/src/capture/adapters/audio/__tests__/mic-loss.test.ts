// Task 4 row 68 (WP-07a): MICROPHONE LOSS of the production microphone adapter.
//
// What is real here: the card listing parser over fixed texts in the forms of a Linux host (the
// fixture a test changes between two listings), the match by stored identity
// (`identifyRegisteredCard`), and - in blocks 1 and 4 - the SHARED SIMULATOR behind the fault sink
// (`createSim`, capture external): its two internal actions are what the Core's engine calls, so
// "one fault, one audit entry" is counted on real `FAULT_RAISED` / `FAULT_CLEARED` rows.
// What is a double: the host (no sound card on this Mac), the timers (manual), the list of held
// microphones (a set of the test).
//
// No process, no port, no file, no database.
import { CaptureWarningCode, CaptureWarningReason } from '@dems/capture-protocol';
import { createManualClock, createSim, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { relativeImports } from '../../../../../test/static/imports';
import { WORKSPACE, codeOnly, isProductionSource, readTree } from '../../../../../test/static/scan';
import { manualTimers } from '../../local/__tests__/mic-support';
import { createCardEnumerator, type CardEnumerator, type CardListingSource } from '../card-listing';
import { MIC_CARD_ABSENT, MIC_CARD_CHANGED, MIC_LOSS_INTERVAL_MS, MIC_LOSS_MIN_INTERVAL_MS, MicLossCause, MicLossReportCode, MicLossState, createMicLossWatch, type MicFaultSink, type MicLossChange, type MicLossFault, type MicLossReport } from '../mic-loss';
import { UsbAudioError, UsbAudioRefusal, identifyRegisteredCard, isRegisteredAudioInput, type RegisteredAudioInput, type UsbAudioProductionOptions } from '../usb-audio-production';

// ── The host: fixed texts in the forms of a Linux host (the fixture of row 67, in short) ───────

interface FixtureCard {
  readonly index: number;
  readonly id: string;
  readonly product: string;
  readonly usbId: string;
  readonly port: string;
  readonly channels: number;
  /** The serial the USB device states (task 4 row 200). Left out: it states none. */
  readonly serial?: string;
}

interface Host {
  cards: FixtureCard[];
  failing: boolean;
  readonly enumerator: CardEnumerator;
  lists(): number;
}

function hostOf(cards: FixtureCard[]): Host {
  let lists = 0;
  const host: Host = { cards, failing: false, enumerator: undefined as unknown as CardEnumerator, lists: () => lists };
  const at = (cardIndex: number): FixtureCard | undefined => host.cards.find((card) => card.index === cardIndex);
  const source: CardListingSource = {
    async captureDevices() {
      lists += 1;
      if (host.failing) throw Object.assign(new Error('the listing program could not be run'), { code: 'EACCES' });
      return `**** List of CAPTURE Hardware Devices ****\n${host.cards.map((card) => `card ${card.index}: ${card.id} [${card.product}], device 0: USB Audio [USB Audio]\n  Subdevices: 1/1\n  Subdevice #0: subdevice #0\n`).join('')}`;
    },
    async presentCards() {
      return host.cards.map((card) => `${String(card.index).padStart(2)} [${card.id.padEnd(15)}]: USB-Audio - ${card.product}\n                      ${card.product}\n`).join('');
    },
    async usbId(cardIndex) {
      const card = at(cardIndex);
      return card === undefined ? null : `${card.usbId}\n`;
    },
    async usbSerial(cardIndex) {
      const card = at(cardIndex);
      return card?.serial === undefined ? null : `${card.serial}\n`;
    },
    async stream(cardIndex) {
      const card = at(cardIndex);
      if (card === undefined) return null;
      return `${card.product} at usb-${card.port}, high speed : USB Audio\n\nCapture:\n  Status: Stop\n  Interface 1\n    Altset 1\n    Format: S24_3LE\n    Channels: ${card.channels}\n    Endpoint: 0x81 (1 IN) (ASYNC)\n    Rates: 44100, 48000\n    Bits: 24\n\n`;
    },
  };
  (host as { enumerator: CardEnumerator }).enumerator = createCardEnumerator(source);
  return host;
}

const DUO: FixtureCard = { index: 1, id: 'Duo', product: 'DEMS Test Duo', usbId: '1a2b:0001', port: '0000:00:14.0-2', channels: 2 };
const OCTO: FixtureCard = { index: 2, id: 'Octo', product: 'DEMS Test Octo', usbId: '1a2b:0008', port: '0000:00:14.0-3.1', channels: 8 };
/** Another product that the kernel gave the name of the registered card. */
const IMPOSTOR: FixtureCard = { index: 1, id: 'Duo', product: 'DEMS Other Codec', usbId: '3c4d:2902', port: '0000:00:14.0-4', channels: 2 };

// Task 4 row 200: a stored row holds the port path its card was registered on (the fixture cards state no serial); since R-FLEX row 107 the match does not compare it (information only).
const row = (deviceId: string, card: FixtureCard, inputNumber: number): RegisteredAudioInput => ({ deviceId, usbId: card.usbId, usbSerial: card.serial ?? null, usbPort: card.port, cardId: card.id, cardDevice: 0, inputNumber, nativeChannels: card.channels });

// ── The sinks ───────────────────────────────────────────────────────────────────────

/** A sink that records. `failing` makes the next calls throw. */
function recordingSink() {
  const calls: string[] = [];
  const state = { failing: false };
  const say = (word: string, fault: MicLossFault): void => {
    if (state.failing) throw Object.assign(new Error('the engine is busy'), { code: 'ENGINE_BUSY' });
    calls.push(`${word} ${fault.code}/${fault.reason}@${fault.subject}`);
  };
  const sink: MicFaultSink = { raise: async (fault) => say('raise', fault), clear: async (fault) => say('clear', fault) };
  return { sink, calls, state };
}

const START = Date.UTC(2026, 9, 1, 3, 0, 0);

/** THE REAL SIMULATOR behind the sink: the two internal actions the Core's engine calls. */
function simulatorSink() {
  const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario: 'recording', capture: 'external' });
  const sink: MicFaultSink = {
    raise: (fault) => sim.actions.raiseCaptureWarning(fault),
    clear: (fault) => sim.actions.clearCaptureWarning(fault),
  };
  const state = (): SimState => sim.store.getState();
  /** The active faults of a lost microphone, as `reason@target`. */
  const faults = (): string[] => state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT').map((fault) => `${String(fault.reason)}@${String(fault.target)}`);
  /** The audit rows of the capture fault, as `TYPE reason`. */
  const audits = (): string[] => state().audit.rows.filter((entry) => entry.details?.['kind'] === 'CAPTURE_FAULT').map((entry) => `${entry.type} ${String(entry.details?.['reason'])}`);
  /** The ACTIVE alerts of the capture fault that name the reason. */
  const alerts = (): number => state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT' && alert.active && alert.params?.['reason'] === 'MIC_DISCONNECTED').length;
  return { sim, sink, state, faults, audits, alerts };
}

interface RigOptions {
  readonly cards?: FixtureCard[];
  readonly rows?: RegisteredAudioInput[];
  readonly sink?: MicFaultSink;
  readonly intervalMs?: number;
  /** Task 4 row 85c: whether the capture attempt of a microphone's handle is superseded. Left out: the option is not handed in. */
  readonly superseded?: (deviceId: string) => boolean;
}

function rig(options: RigOptions = {}) {
  const host = hostOf(options.cards ?? [DUO, OCTO]);
  const rows = new Map((options.rows ?? [row('MIC-01', DUO, 1), row('MIC-02', DUO, 2)]).map((entry) => [entry.deviceId, entry]));
  const recorded = recordingSink();
  const timers = manualTimers();
  const held = new Set<string>();
  const changes: MicLossChange[] = [];
  const reports: MicLossReport[] = [];
  const unreadable = new Set<string>();
  const watched = { ids: [...rows.keys()] };
  const watch = createMicLossWatch({
    devices: () => watched.ids,
    registered: async (deviceId) => {
      if (unreadable.has(deviceId)) throw Object.assign(new Error('the row could not be read'), { code: 'ECONNREFUSED' });
      return rows.get(deviceId) ?? null;
    },
    // The adapter's own match and shape rule, as the composition hands them in.
    identify: identifyRegisteredCard,
    isRow: isRegisteredAudioInput,
    cards: host.enumerator,
    held: () => [...held],
    faults: options.sink ?? recorded.sink,
    timers,
    ...(options.intervalMs === undefined ? {} : { intervalMs: options.intervalMs }),
    ...(options.superseded === undefined ? {} : { superseded: options.superseded }),
    onChange: (change) => void changes.push(change),
    report: (entry) => void reports.push(entry),
  });
  const said = (): string[] => changes.map((change) => `${change.state} ${change.deviceId} ${change.cause}`);
  return { host, rows, watch, timers, held, changes, said, reports, unreadable, watched, calls: recorded.calls, sinkState: recorded.state };
}

// ── 1. The row's cell, on the real simulator ────────────────────────────────────────

describe('row 68 (1): a card removed from the fixture listing raises 1 fault with 1 audit entry; its return clears it', () => {
  it('one registered microphone: removal is ONE fault, ONE alert and ONE FAULT_RAISED row, however many listings follow; the return - at another card index - clears it with ONE FAULT_CLEARED row', async () => {
    const real = simulatorSink();
    const h = rig({ rows: [row('MIC-01', DUO, 1)], sink: real.sink });
    const before = real.state();

    await h.watch.check();
    // Present: nothing is raised, nothing is written.
    expect(real.faults()).toEqual([]);
    expect(real.state().audit).toBe(before.audit);
    expect(h.said()).toEqual([]);

    // The card is unplugged: it is no longer in the listing.
    h.host.cards = [OCTO];
    await h.watch.check();
    expect(real.faults()).toHaveLength(1);
    expect(real.faults()[0]).toMatch(/^MIC_DISCONNECTED@/);
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED']);
    expect(real.alerts()).toBe(1);
    expect(h.said()).toEqual(['LOST MIC-01 CARD_ABSENT']);
    expect(h.watch.lost()).toEqual(['MIC-01']);

    // It stays unplugged for three more listings: still one fault, one row, one alert.
    for (let pass = 0; pass < 3; pass += 1) await h.watch.check();
    expect(real.faults()).toHaveLength(1);
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED']);
    expect(real.alerts()).toBe(1);
    expect(h.said()).toEqual(['LOST MIC-01 CARD_ABSENT']);

    // It is plugged in again and the kernel gives it ANOTHER index: found by its identity, the fault is over.
    h.host.cards = [OCTO, { ...DUO, index: 5 }];
    await h.watch.check();
    expect(real.faults()).toEqual([]);
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED', 'FAULT_CLEARED MIC_DISCONNECTED']);
    expect(real.alerts()).toBe(0);
    expect(h.said()).toEqual(['LOST MIC-01 CARD_ABSENT', 'RETURNED MIC-01 CARD_ABSENT']);
    expect(h.watch.lost()).toEqual([]);

    // A second unplug is a NEW fault with its own row.
    h.host.cards = [OCTO];
    await h.watch.check();
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED', 'FAULT_CLEARED MIC_DISCONNECTED', 'FAULT_RAISED MIC_DISCONNECTED']);
    expect(real.faults()).toHaveLength(1);
  });

  it('the audit entry names the microphone by its registry id and carries no text of a card', async () => {
    const real = simulatorSink();
    const h = rig({ rows: [row('MIC-01', DUO, 1)], sink: real.sink });
    h.host.cards = [];
    await h.watch.check();
    const entry = real.state().audit.rows.filter((candidate) => candidate.type === 'FAULT_RAISED').at(-1);
    expect(entry).toMatchObject({ type: 'FAULT_RAISED', actorId: null, details: { kind: 'CAPTURE_FAULT', reason: 'MIC_DISCONNECTED' } });
    const text = JSON.stringify(entry);
    for (const value of [DUO.product, DUO.usbId, DUO.port, 'Duo']) expect(text).not.toContain(value);
  });

  it('the Core never switches the audio source by itself: after the loss of the ACTIVE microphone the active input is what it was and no switch row exists', async () => {
    const real = simulatorSink();
    const h = rig({ rows: [row('MIC-01', DUO, 1), row('MIC-02', OCTO, 3)], sink: real.sink });
    const active = real.state().audio.activeInputId;
    expect(active).toBe('MIC-01');
    h.host.cards = [OCTO];
    await h.watch.check();
    expect(real.faults()).toHaveLength(1);
    expect(real.state().audio.activeInputId).toBe(active);
    expect(real.state().audit.rows.filter((entry) => entry.type === 'AUDIO_SOURCE_SWITCHED')).toEqual([]);
    expect(real.state().session?.state).toBe('RECORDING');
  });

  it('the word of the capture worker and the word of the watch about one microphone are ONE fault and ONE audit entry (the key is kind, reason, device)', async () => {
    const real = simulatorSink();
    const h = rig({ rows: [row('MIC-01', DUO, 1)], sink: real.sink });
    // The worker saw no sample first (its WARNING frame, as the forwarder hands it to the engine).
    const workers: MicLossFault = { code: CaptureWarningCode.CAPTURE_FAULT, subject: 'MIC-01', reason: CaptureWarningReason.MIC_DISCONNECTED };
    real.sim.actions.raiseCaptureWarning(workers);
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED']);
    h.host.cards = [OCTO];
    await h.watch.check();
    expect(real.faults()).toHaveLength(1);
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED']);
    expect(real.alerts()).toBe(1);
  });
});

// ── 2. What a listing says, and what it does not ────────────────────────────────────

describe('row 68 (2): the card is looked for by its stored identity; what cannot be told is no loss', () => {
  it('two inputs of one card are two faults when the card goes and two clears when it returns; an input of another card is untouched', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1), row('MIC-02', DUO, 2), row('MIC-03', OCTO, 5)] });
    h.host.cards = [OCTO];
    await h.watch.check();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01', 'raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-02']);
    h.host.cards = [DUO, OCTO];
    await h.watch.check();
    expect(h.calls.slice(2)).toEqual(['clear CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01', 'clear CAPTURE_FAULT/MIC_DISCONNECTED@MIC-02']);
    // One listing per pass, whatever the number of microphones.
    expect(h.host.lists()).toBe(2);
  });

  it('ANOTHER card under the registered card\'s name is a loss (CARD_CHANGED): the card at the old index is not taken for the registered one', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.host.cards = [IMPOSTOR, OCTO];
    await h.watch.check();
    expect(h.said()).toEqual(['LOST MIC-01 CARD_CHANGED']);
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    // The registered card is back beside it: over.
    h.host.cards = [{ ...IMPOSTOR, id: 'Codec' }, OCTO, { ...DUO, index: 4 }];
    await h.watch.check();
    expect(h.said()).toEqual(['LOST MIC-01 CARD_CHANGED', 'RETURNED MIC-01 CARD_CHANGED']);
  });

  // R-FLEX row 107 (T-4; D10 ruling 1, no port lock): the bench microphone states no serial; moved to another socket it is the bound card.
  it('T-4: a serial-less card unplugged and plugged into ANOTHER port: pass 1 raises MIC_DISCONNECTED (CARD_ABSENT), pass 2 clears it (RETURNED); no CARD_CHANGED cause', async () => {
    const real = simulatorSink();
    const h = rig({ rows: [row('MIC-01', DUO, 1)], sink: real.sink });
    h.host.cards = [OCTO];
    await h.watch.check();
    expect(real.faults()).toHaveLength(1);
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED']);
    h.host.cards = [OCTO, { ...DUO, index: 4, port: '0000:00:14.0-7' }];
    await h.watch.check();
    expect(real.faults()).toEqual([]);
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED', 'FAULT_CLEARED MIC_DISCONNECTED']);
    expect(h.said()).toEqual(['LOST MIC-01 CARD_ABSENT', 'RETURNED MIC-01 CARD_ABSENT']);
    expect(h.changes.filter((change) => change.cause === MicLossCause.CARD_CHANGED)).toEqual([]);
    expect(h.watch.lost()).toEqual([]);
  });

  // R-FLEX row 107 (T-5; Q96-03 (iii), AU-R2): two serial-less units of the stored model cannot be told apart - undecided, no fault.
  it('T-5: two serial-less units of the stored model: CARD_UNDECIDED with AUDIO_CARD_AMBIGUOUS, 0 faults raised', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.host.cards = [DUO, { ...DUO, index: 7, id: 'Duo_1', port: '0000:00:14.0-5' }];
    await h.watch.check();
    expect(h.calls).toEqual([]);
    expect(h.said()).toEqual([]);
    expect(h.reports.map((entry) => `${entry.code} ${String(entry.deviceId)} ${entry.detail}`)).toEqual([`${MicLossReportCode.CARD_UNDECIDED} MIC-01 ${UsbAudioRefusal.CARD_AMBIGUOUS}`]);
  });

  it('a listing that could not be made raises nothing and clears nothing: before a loss and during one', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.host.failing = true;
    await h.watch.check();
    expect(h.calls).toEqual([]);
    expect(h.reports).toEqual([{ source: 'capture.adapters.audio.mic-loss', code: MicLossReportCode.LISTING_FAILED, deviceId: null, detail: 'EACCES' }]);
    // Now a real loss, then the listing fails while the card is in fact back: the fault stays until a listing SHOWS the card.
    h.host.failing = false;
    h.host.cards = [];
    await h.watch.check();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    h.host.cards = [DUO];
    h.host.failing = true;
    await h.watch.check();
    expect(h.calls).toHaveLength(1);
    expect(h.watch.lost()).toEqual(['MIC-01']);
    h.host.failing = false;
    await h.watch.check();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01', 'clear CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
  });

  it('two cards with the stored identity, a stored row that cannot be read, and a microphone with no row: none is a loss; each is reported by its code', async () => {
    // Task 4 row 200: "two cards with the stored identity" here is two units that state the STORED
    // SERIAL, neither on the stored port (the serial-less case is T-5 above, R-FLEX row 107).
    const twin = { ...DUO, serial: 'SN-SAME' };
    const h = rig({ rows: [row('MIC-01', twin, 1), row('MIC-02', OCTO, 1)] });
    h.watched.ids = ['MIC-01', 'MIC-02', 'MIC-09'];
    h.host.cards = [{ ...twin, port: '0000:00:14.0-6' }, { ...twin, index: 7, id: 'Duo_1', port: '0000:00:14.0-5' }, OCTO];
    h.unreadable.add('MIC-02');
    await h.watch.check();
    expect(h.calls).toEqual([]);
    expect(h.said()).toEqual([]);
    expect(h.reports.map((entry) => `${entry.code} ${String(entry.deviceId)} ${entry.detail}`)).toEqual([
      `${MicLossReportCode.CARD_UNDECIDED} MIC-01 ${UsbAudioRefusal.CARD_AMBIGUOUS}`,
      `${MicLossReportCode.ROW_UNREADABLE} MIC-02 ECONNREFUSED`,
    ]);
    // No report carries a text of a card.
    for (const value of [DUO.product, DUO.usbId, DUO.port]) expect(JSON.stringify(h.reports)).not.toContain(value);
  });

  it('a microphone that is no longer registered while its fault is active: the fault is cleared and the episode forgotten', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.host.cards = [];
    await h.watch.check();
    expect(h.watch.lost()).toEqual(['MIC-01']);
    h.watched.ids = [];
    await h.watch.check();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01', 'clear CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    expect(h.watch.lost()).toEqual([]);
  });

  it('a sink that refuses is asked again at the next pass, and the loss is told once it was written: one raise in the end', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.host.cards = [];
    h.sinkState.failing = true;
    await h.watch.check();
    expect(h.calls).toEqual([]);
    expect(h.said()).toEqual([]);
    expect(h.reports.map((entry) => `${entry.code} ${String(entry.deviceId)} ${entry.detail}`)).toEqual([`${MicLossReportCode.SINK_FAILED} MIC-01 ENGINE_BUSY`]);
    h.sinkState.failing = false;
    await h.watch.check();
    await h.watch.check();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    expect(h.said()).toEqual(['LOST MIC-01 CARD_ABSENT']);
  });
});

// ── 3. The helper that ended (the adapter's loss callback) ──────────────────────────

describe('row 68 (3): the adapter\'s word that a helper ended', () => {
  const ended = new UsbAudioError(UsbAudioRefusal.HELPER_EXITED, 'MIC-01', 'EXIT_1');

  it('`sourceLost` has the shape of the adapter\'s `onSourceLost` and raises ONE fault; a second word and the next listings add nothing', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    // The type the composition relies on: the member is handed to the adapter as it is.
    const hook: NonNullable<UsbAudioProductionOptions['onSourceLost']> = h.watch.sourceLost;
    h.held.add('MIC-01');
    hook('MIC-01', ended);
    hook('MIC-01', new UsbAudioError(UsbAudioRefusal.NO_SAMPLE, 'MIC-01'));
    await h.watch.settled();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    expect(h.said()).toEqual(['LOST MIC-01 HELPER_ENDED']);
    await h.watch.check();
    await h.watch.check();
    expect(h.calls).toHaveLength(1);
  });

  it('the card is there the whole time: the fault stays while the handle is held (the microphone delivers nothing) and ends when the handle is closed', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.held.add('MIC-01');
    h.watch.sourceLost('MIC-01', ended);
    await h.watch.check();
    expect(h.watch.lost()).toEqual(['MIC-01']);
    expect(h.calls).toHaveLength(1);
    h.held.delete('MIC-01');
    await h.watch.check();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01', 'clear CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    expect(h.said()).toEqual(['LOST MIC-01 HELPER_ENDED', 'RETURNED MIC-01 HELPER_ENDED']);
  });

  it('unplugged in mid session: the helper ends AND the card is absent - ONE fault; the card returns while the handle is held - the fault STAYS (no helper is started again); closed - over', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.held.add('MIC-01');
    h.host.cards = [OCTO];
    h.watch.sourceLost('MIC-01', ended);
    await h.watch.check();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    h.host.cards = [OCTO, { ...DUO, index: 3 }];
    await h.watch.check();
    await h.watch.check();
    expect(h.calls).toHaveLength(1);
    expect(h.watch.lost()).toEqual(['MIC-01']);
    h.held.delete('MIC-01');
    await h.watch.check();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01', 'clear CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
  });

  it('closed while the card is still unplugged: the fault stays for the card, and ends when a listing shows it', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.held.add('MIC-01');
    h.host.cards = [];
    h.watch.sourceLost('MIC-01', ended);
    await h.watch.check();
    h.held.delete('MIC-01');
    await h.watch.check();
    expect(h.calls).toHaveLength(1);
    h.host.cards = [DUO];
    await h.watch.check();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01', 'clear CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
  });

  it('a word about something that is no microphone id is dropped', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.watch.sourceLost('../MIC-01', ended);
    h.watch.sourceLost('CAM-01', ended);
    await h.watch.settled();
    expect(h.calls).toEqual([]);
  });

  // Task 4 row 85c (decision C60 (2); the measurement of row 191: the helper of the earlier attempt ended 33 to 46 ms after its
  // worker, the session's close of that handle began 12 to 19 ms after). The watch is told whether the attempt is superseded.
  it('row 85c: a word about a handle of a SUPERSEDED attempt raises nothing - no fault, no change, no episode - and is reported by its code; the session then closes and opens the handle and nothing is left', async () => {
    const state = { replacing: true };
    const asked: string[] = [];
    const h = rig({
      rows: [row('MIC-01', DUO, 1)],
      superseded: (deviceId) => {
        asked.push(deviceId);
        return state.replacing;
      },
    });
    h.held.add('MIC-01');
    // The worker of attempt 1 went down; its helper ends before the session's close reaches the handle.
    h.watch.sourceLost('MIC-01', ended);
    // Asked in the turn of the word, before anything is queued.
    expect(asked).toEqual(['MIC-01']);
    await h.watch.settled();
    expect([h.calls, h.said(), h.watch.lost()]).toEqual([[], [], []]);
    expect(h.reports.map((entry) => `${entry.code} ${String(entry.deviceId)}`)).toEqual(['MIC_LOSS_REPORT_SUPERSEDED MIC-01']);
    // The session closes the handle and opens it again for attempt 2 (row 191): the passes see a card that is there. Nothing was raised, so nothing is cleared.
    h.held.delete('MIC-01');
    await h.watch.check();
    h.held.add('MIC-01');
    await h.watch.check();
    expect([h.calls, h.said()]).toEqual([[], []]);
    // Control: the SAME word once the later worker records is a loss of the attempt in force.
    state.replacing = false;
    h.watch.sourceLost('MIC-01', ended);
    await h.watch.settled();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    expect(asked).toEqual(['MIC-01', 'MIC-01']);
  });

  it('row 85c: a superseded word does not hide a card that is really gone (the listing pass tells it), and does not end an episode that is open', async () => {
    const state = { replacing: false };
    const h = rig({ rows: [row('MIC-01', DUO, 1)], superseded: () => state.replacing });
    h.held.add('MIC-01');
    // An episode of the attempt in force.
    h.watch.sourceLost('MIC-01', ended);
    await h.watch.settled();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    // A later word while the worker is replaced: dropped; the open episode is neither raised again nor cleared by it.
    state.replacing = true;
    h.watch.sourceLost('MIC-01', ended);
    await h.watch.settled();
    expect(h.calls).toHaveLength(1);
    expect(h.watch.lost()).toEqual(['MIC-01']);
    // Another microphone, unplugged while its attempt is superseded: the word is dropped, the LISTING raises.
    const gone = rig({ rows: [row('MIC-01', DUO, 1)], superseded: () => true });
    gone.held.add('MIC-01');
    gone.host.cards = [OCTO];
    gone.watch.sourceLost('MIC-01', ended);
    await gone.watch.settled();
    expect(gone.calls).toEqual([]);
    await gone.watch.check();
    expect(gone.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    expect(gone.said()).toEqual(['LOST MIC-01 CARD_ABSENT']);
  });

  it('row 85c, fail-closed: a question that throws does not hide a loss - the word counts and the failure is reported; anything but `true` is not superseded; without the option every word counts', async () => {
    const thrown = rig({
      rows: [row('MIC-01', DUO, 1)],
      superseded: () => {
        throw Object.assign(new Error('the supervisor could not be asked'), { code: 'NOT_READY' });
      },
    });
    thrown.held.add('MIC-01');
    thrown.watch.sourceLost('MIC-01', ended);
    await thrown.watch.settled();
    expect(thrown.calls).toEqual(['raise CAPTURE_FAULT/MIC_DISCONNECTED@MIC-01']);
    expect(thrown.reports.map((entry) => `${entry.code} ${entry.detail}`)).toEqual(['MIC_LOSS_ATTEMPT_UNREADABLE NOT_READY']);
    const truthy = rig({ rows: [row('MIC-01', DUO, 1)], superseded: (() => 'yes') as unknown as () => boolean });
    truthy.held.add('MIC-01');
    truthy.watch.sourceLost('MIC-01', ended);
    await truthy.watch.settled();
    expect(truthy.calls).toHaveLength(1);
    const plain = rig({ rows: [row('MIC-01', DUO, 1)] });
    plain.held.add('MIC-01');
    plain.watch.sourceLost('MIC-01', ended);
    await plain.watch.settled();
    expect(plain.calls).toHaveLength(1);
  });
});

// ── 4. The schedule ─────────────────────────────────────────────────────────────

describe('row 68 (4): the passes', () => {
  it('start is one pass now and one per interval; stop ends them and touches no fault; twice is once', async () => {
    const real = simulatorSink();
    const h = rig({ rows: [row('MIC-01', DUO, 1)], sink: real.sink });
    h.watch.start();
    h.watch.start();
    await h.watch.settled();
    await Promise.resolve();
    expect(h.host.lists()).toBe(1);
    expect(h.timers.pending()).toEqual([MIC_LOSS_INTERVAL_MS]);
    h.host.cards = [];
    expect(h.timers.fire(MIC_LOSS_INTERVAL_MS)).toBe(true);
    await h.watch.settled();
    await Promise.resolve();
    expect(h.host.lists()).toBe(2);
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED']);
    expect(h.timers.pending()).toEqual([MIC_LOSS_INTERVAL_MS]);
    h.watch.stop();
    expect(h.timers.pending()).toEqual([]);
    // Stopped: the fault is what it was.
    expect(real.faults()).toHaveLength(1);
    expect(real.audits()).toEqual(['FAULT_RAISED MIC_DISCONNECTED']);
  });

  it('the interval is never below the minimum, and a value that is no number is the default', () => {
    const fast = rig({ intervalMs: 10 });
    fast.watch.start();
    const odd = rig({ intervalMs: Number.NaN });
    odd.watch.start();
    return Promise.all([fast.watch.settled(), odd.watch.settled()])
      .then(() => Promise.resolve())
      .then(() => {
        expect(fast.timers.pending()).toEqual([MIC_LOSS_MIN_INTERVAL_MS]);
        expect(odd.timers.pending()).toEqual([MIC_LOSS_INTERVAL_MS]);
        expect(MIC_LOSS_MIN_INTERVAL_MS).toBe(1_000);
        expect(MIC_LOSS_INTERVAL_MS).toBe(5_000);
      });
  });

  it('a listing that fails in a scheduled pass does not end the schedule', async () => {
    const h = rig({ rows: [row('MIC-01', DUO, 1)] });
    h.host.failing = true;
    h.watch.start();
    await h.watch.settled();
    await Promise.resolve();
    expect(h.timers.pending()).toEqual([MIC_LOSS_INTERVAL_MS]);
    expect(h.reports.map((entry) => entry.code)).toEqual([MicLossReportCode.LISTING_FAILED]);
  });
});

// ── 5. Static: what the file may reach ──────────────────────────────────────────────

describe('row 68 (5): the watch can switch, start and write nothing', () => {
  const FILE = 'src/capture/adapters/audio/mic-loss.ts';
  const tree = codeOnly(readTree(WORKSPACE).filter((file) => /\.[cm]?tsx?$/.test(file.path)));
  const source = tree.find((file) => file.path === FILE)?.text ?? '';

  it('it imports the protocol vocabulary, the timers type, the listing and the adapter beside it - no engine, no process, no file system, no database', () => {
    expect(source.length).toBeGreaterThan(2_000);
    const specifiers = [...source.matchAll(/\bfrom\s+'([^']+)'/g)].map((match) => match[1]).sort();
    expect(specifiers).toEqual(['../../types', './card-listing', '@dems/capture-protocol']);
    expect(source).not.toMatch(/\bimport\(/);
    expect(source).not.toMatch(/\brequire\(/);
  });

  it('the match is handed in: the file does not name the adapter (rule A-9), and its two refusal words are the adapter\'s', () => {
    expect(source).not.toMatch(/usb-audio/);
    expect(MIC_CARD_ABSENT).toBe(UsbAudioRefusal.CARD_ABSENT);
    expect(MIC_CARD_CHANGED).toBe(UsbAudioRefusal.CARD_CHANGED);
  });

  it('no word of a switch, a start, an open or a close of a source is in its code', () => {
    for (const word of ['switch', 'activeInput', 'setActive', '.open(', '.close(', 'door(', 'startProduction']) expect(source.toLowerCase()).not.toContain(word.toLowerCase());
    // The one fault it can name: the existing key of a microphone that stopped delivering.
    expect(source.match(/CaptureWarningReason\.\w+/g)).toEqual(['CaptureWarningReason.MIC_DISCONNECTED', 'CaptureWarningReason.MIC_DISCONNECTED']);
    expect(source.match(/CaptureWarningCode\.\w+/g)).toEqual(['CaptureWarningCode.CAPTURE_FAULT', 'CaptureWarningCode.CAPTURE_FAULT']);
  });

  // Task 4 row 88 (THE LIFT): the boot step of the fence builds the watch where the host has a microphone opener - its one production importer.
  it('one production importer: the fence\'s boot step builds the watch (row 88)', () => {
    const importers = relativeImports(tree.filter((file) => isProductionSource(file.path))).filter((entry) => entry.target === FILE.replace(/\.ts$/, ''));
    expect(importers.map((entry) => entry.file)).toEqual(['src/capture/fence/index.ts']);
    // Control: a planted importer is seen.
    expect(relativeImports([{ path: 'src/capture/adapters/real.ts', text: "await import('./audio/mic-loss');\n" }]).map((entry) => entry.target)).toEqual([FILE.replace(/\.ts$/, '')]);
  });

  it('the states and causes are closed sets', () => {
    expect(Object.values(MicLossCause)).toEqual(['CARD_ABSENT', 'CARD_CHANGED', 'HELPER_ENDED']);
    expect(Object.values(MicLossState)).toEqual(['LOST', 'RETURNED']);
  });
});
