// The service of operations 98 and 99, without a database (task 4 blueprint row 70, WP-07c).
//
// WHAT IS REAL: `searchAudioCards`, `registerAudioInput`, the listing gate, the search ids, and the
// enumerator of row 64 with its parser. WHAT IS A STAND-IN: the host (a clock of this file, a unit
// of work that keeps a copy of the stored rows and puts it back when the work throws), the store
// and the registrar (two maps in the place of `capture_devices` and `capture_audio_inputs`) and the source of the
// listing text (`fixtures.ts`). The statements and the real unit are `routes.db.test.ts`.
import { CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS, CaptureAudioCardSearchSchema, CaptureAudioInputRegistrationSchema } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../../../../core';
import { ApiFailure } from '../../../../plugins/error-envelope';
import { createAudioCardSearchIds } from '../index';
import type { EngineUnit } from '../../../../engine';
import { createListingGate, registerAudioInput, searchAudioCards, type AudioCardsCaller, type AudioCardsSeams, type MicrophoneRegistrar, type RegisteredMicrophone } from '../service';
import type { MicrophoneStore } from '../store';
import { DUO, INTERFACE_REPLACED, MALFORMED, NO_CARD, ONBOARD, ONBOARD_ONLY, ONE_INTERFACE, SIX, TWO_CARDS, fakeHost, type FakeHost, type HostTexts } from './fixtures';

const CALLER: AudioCardsCaller = { operatorId: 'OP-0003', deviceId: null };
const START = Date.UTC(2031, 0, 1);

interface StoredDevice {
  model: string;
  enabled: boolean;
  adapterKind: 'USB_AUDIO' | 'FAKE';
  lastSeenAt: number;
}
interface StoredInput {
  deviceId: string;
  usbId: string | null;
  cardId: string;
  cardDevice: number;
  inputNumber: number;
  nativeChannels: number;
  sampleBits: number;
  operatorId: string;
  at: number;
}

interface Rig {
  readonly seams: AudioCardsSeams;
  readonly host: FakeHost;
  readonly audits: AuditEntry[];
  readonly notes: unknown[];
  readonly failures: unknown[];
  readonly admitted: RegisteredMicrophone[];
  readonly devices: Map<string, StoredDevice>;
  readonly inputs: StoredInput[];
  /** A session is open from now on, as the quick read sees it. */
  openSession(open: boolean): void;
  /** A session opens between the listing and the unit: only the unit sees it. */
  openSessionInUnit(): void;
  advance(ms: number): void;
  /** The next call of this store member throws. */
  failNext(member: keyof MicrophoneStore | keyof MicrophoneRegistrar): void;
  /** Takes the registrar of the registry row away. */
  withoutRegistrar(): void;
  /** Takes the enumerator away: a Core outside production capture. */
  withoutEnumerator(): void;
}

function rig(texts: HostTexts): Rig {
  const host = fakeHost(texts);
  let now = START;
  let open = false;
  let openInUnit = false;
  let enumerator: FakeHost['enumerator'] | null = host.enumerator;
  let failing: keyof MicrophoneStore | keyof MicrophoneRegistrar | null = null;
  let registrarGiven = true;
  const audits: AuditEntry[] = [];
  const notes: unknown[] = [];
  const failures: unknown[] = [];
  const admitted: RegisteredMicrophone[] = [];
  // The two seeded test microphones of a Core: the next free id is MIC-03.
  const devices = new Map<string, StoredDevice>([
    ['MIC-01', { model: 'Test microphone 1', enabled: true, adapterKind: 'FAKE', lastSeenAt: 0 }],
    ['MIC-02', { model: 'Test microphone 2', enabled: true, adapterKind: 'FAKE', lastSeenAt: 0 }],
  ]);
  const inputs: StoredInput[] = [];
  const trip = (member: keyof MicrophoneStore | keyof MicrophoneRegistrar): void => {
    if (failing !== member) return;
    failing = null;
    throw Object.assign(new Error(`row070: a failure injected in ${member}`), { code: 'ROW070_INJECTED' });
  };
  const store: MicrophoneStore = {
    async registeredInputs() {
      trip('registeredInputs');
      return inputs.map((input) => ({ deviceId: input.deviceId, cardId: input.cardId, cardDevice: input.cardDevice, inputNumber: input.inputNumber }));
    },
    async inputOf(_db, key) {
      trip('inputOf');
      const found = inputs.find((input) => input.cardId === key.cardId && input.cardDevice === key.cardDevice && input.inputNumber === key.inputNumber);
      return found === undefined ? null : { deviceId: found.deviceId, usbId: found.usbId, enabled: devices.get(found.deviceId)?.enabled === true };
    },
    async insertInput(_db, input) {
      trip('insertInput');
      inputs.push({ ...input });
    },
    async refreshInput(_db, input) {
      trip('refreshInput');
      const held = inputs.find((entry) => entry.deviceId === input.deviceId);
      if (held === undefined) throw new Error('row070: no such input');
      Object.assign(held, { usbId: input.usbId, nativeChannels: input.nativeChannels, sampleBits: input.sampleBits, operatorId: input.operatorId, at: input.at });
    },
  };
  const registrar: MicrophoneRegistrar = {
    async register(_unit, device) {
      trip('register');
      const highest = [...devices.keys()].reduce((max, id) => Math.max(max, Number(/^MIC-(\d+)$/.exec(id)?.[1] ?? 0)), 0);
      const id = `MIC-${String(highest + 1).padStart(2, '0')}`;
      devices.set(id, { model: device.model, enabled: true, adapterKind: 'USB_AUDIO', lastSeenAt: device.at });
      return id;
    },
    async reenable(_unit, device) {
      trip('reenable');
      const held = devices.get(device.deviceId);
      if (held === undefined) throw new Error('row070: no such device');
      devices.set(device.deviceId, { ...held, enabled: true, model: device.model, lastSeenAt: device.at });
    },
  };
  const db = { query: async () => ({ rows: [], rowCount: 0 }) };
  const seams: AudioCardsSeams = {
    store,
    gate: createListingGate(() => now),
    enumerator: () => enumerator,
    registrar: () => (registrarGiven ? registrar : null),
    admit: (device) => void admitted.push(device),
    nextSearchId: createAudioCardSearchIds(),
    host: {
      now: () => now,
      sessionOpen: () => open,
      read: (_label, work) => work(db),
      async unit(_label, work) {
        // A unit of work: what it stored and appended is put back when the work throws.
        const before = { devices: structuredClone([...devices]), inputs: structuredClone(inputs), audits: audits.length };
        const tasks: (() => void)[] = [];
        try {
          const value = await work({ db, scope: {} as EngineUnit, sessionOpen: () => open || openInUnit, audit: async (entry) => void audits.push(entry), afterCommit: (task) => void tasks.push(task) });
          for (const task of tasks) task();
          return value;
        } catch (error) {
          devices.clear();
          for (const [id, device] of before.devices) devices.set(id, device);
          inputs.splice(0, inputs.length, ...before.inputs);
          audits.splice(before.audits);
          throw error;
        }
      },
      note: (fields) => void notes.push(fields),
      failed: (source, message, error, context) => void failures.push({ source, message, code: (error as { code?: string }).code ?? null, context }),
    },
  };
  return {
    seams,
    host,
    audits,
    notes,
    failures,
    admitted,
    devices,
    inputs,
    openSession: (value) => {
      open = value;
    },
    openSessionInUnit: () => {
      openInUnit = true;
    },
    advance: (ms) => {
      now += ms;
    },
    failNext: (member) => {
      failing = member;
    },
    withoutEnumerator: () => {
      enumerator = null;
    },
    withoutRegistrar: () => {
      registrarGiven = false;
    },
  };
}

/** The refusal of a call: status, code and `details.reason`. */
async function refusal(pending: Promise<unknown>): Promise<[number, string, unknown] | 'answered'> {
  try {
    await pending;
    return 'answered';
  } catch (error) {
    if (!(error instanceof ApiFailure)) throw error;
    return [error.statusCode, error.code, error.details?.['reason'] ?? null];
  }
}
const usbMicrophones = (devices: Map<string, StoredDevice>): string[] => [...devices].filter(([, device]) => device.adapterKind === 'USB_AUDIO').map(([id]) => id);
/** Everything a rig wrote where device text must not be: the audit rows, the log notes, the failures. */
const written = (r: Rig): string => JSON.stringify([r.audits, r.notes, r.failures]);
const DEVICE_TEXT = [DUO.cardId, DUO.product, DUO.usbId, SIX.cardId, SIX.product, SIX.usbId, ONBOARD.cardId, ONBOARD.product];

describe('operation 98: the listing through the injected enumerator', () => {
  it('two cards: one entry each with the facts of the listing, no registered input; nothing stored; one CAPTURE_DISCOVERY_SEARCHED row with scope AUDIO_CARDS and counts', async () => {
    const r = rig(TWO_CARDS);
    const answer = await searchAudioCards(r.seams, CALLER);
    expect(CaptureAudioCardSearchSchema.safeParse(answer).success).toBe(true);
    expect(answer).toEqual({
      searchedAt: START,
      truncated: false,
      cards: [
        { cardId: DUO.cardId, deviceIndex: 0, usbId: DUO.usbId, product: DUO.product, channelCount: 2, sampleBits: [24], registered: [] },
        { cardId: SIX.cardId, deviceIndex: 0, usbId: SIX.usbId, product: SIX.product, channelCount: 6, sampleBits: [24], registered: [] },
      ],
    });
    expect(usbMicrophones(r.devices)).toEqual([]);
    expect(r.inputs).toEqual([]);
    expect(r.admitted).toEqual([]);
    expect(r.audits).toEqual([
      {
        type: 'CAPTURE_DISCOVERY_SEARCHED',
        message: 'Sound cards listed',
        actorId: CALLER.operatorId,
        deviceId: null,
        details: { searchId: `DSC-${START}`, scope: 'AUDIO_CARDS', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 2, newCount: 2, registeredCount: 0, interfaceCount: 0, operationId: 'searchCaptureAudioCards', permission: 'CAPTURE_CONFIG' },
      },
    ]);
    for (const text of DEVICE_TEXT) expect(written(r), text).not.toContain(text);
  });

  it('no card: an empty list and a row with 0 responders; a malformed listing: an empty list too, and nothing of the text is answered', async () => {
    const none = rig(NO_CARD);
    expect(await searchAudioCards(none.seams, CALLER)).toEqual({ searchedAt: START, cards: [], truncated: false });
    expect(none.audits.map((row) => row.details?.['responderCount'])).toEqual([0]);

    const malformed = rig(MALFORMED);
    const answer = await searchAudioCards(malformed.seams, CALLER);
    expect(answer.cards).toEqual([]);
    expect(JSON.stringify([answer, malformed.audits, malformed.notes])).not.toMatch(/rm -rf|evil|garbage|Too\$Many/);
    expect(malformed.audits).toHaveLength(1);
  });

  it('a source that fails: 503 NOT_READY, no audit row, the failure persisted by its code with no text of the host', async () => {
    const r = rig(TWO_CARDS);
    r.host.failOnce(Object.assign(new Error(`cannot read /proc/asound/${DUO.cardId}`), { code: 'EACCES' }));
    expect(await refusal(searchAudioCards(r.seams, CALLER))).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
    expect(r.audits).toEqual([]);
    expect(r.failures).toEqual([{ source: 'captureAudioCards.list', message: 'the sound cards of the host could not be listed', code: 'EACCES', context: { purpose: 'SEARCH' } }]);
    // The gate is free again: the next search (after the spacing) lists.
    r.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
    expect((await searchAudioCards(r.seams, CALLER)).cards).toHaveLength(2);
  });
});

describe('operation 99: the registration unit', () => {
  it('a multi-input interface: input 4 becomes the next free MIC-nn with the facts of the Core\'s own listing; registered twice it is ONE device, re-enabled', async () => {
    const r = rig(ONE_INTERFACE);
    const first = await registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 4 });
    expect(first).toEqual({ created: true, registration: { deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 4, channelCount: 6 } });
    expect(CaptureAudioInputRegistrationSchema.safeParse(first.registration).success).toBe(true);
    expect(r.devices.get('MIC-03')).toEqual({ model: SIX.product, enabled: true, adapterKind: 'USB_AUDIO', lastSeenAt: START });
    expect(r.inputs).toEqual([{ deviceId: 'MIC-03', usbId: SIX.usbId, cardId: SIX.cardId, cardDevice: 0, inputNumber: 4, nativeChannels: 6, sampleBits: 24, operatorId: CALLER.operatorId, at: START }]);
    expect(r.admitted).toEqual([{ id: 'MIC-03', kind: 'MIC', adapterKind: 'USB_AUDIO', model: SIX.product }]);

    // The microphone went off meanwhile (a stored state of this file).
    r.devices.set('MIC-03', { ...r.devices.get('MIC-03')!, enabled: false });
    r.advance(1_000);
    const second = await registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 4 });
    expect(second).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 4, channelCount: 6 } });
    expect(usbMicrophones(r.devices)).toEqual(['MIC-03']);
    expect(r.inputs).toHaveLength(1);
    expect(r.devices.get('MIC-03')?.enabled).toBe(true);

    // Each change: ONE entry, with the closed keys and no device text.
    expect(r.audits.map((row) => [row.type, row.actorId, row.deviceId, row.details])).toEqual([
      ['CAPTURE_AUDIO_INPUT_CHANGED', CALLER.operatorId, 'MIC-03', { deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 4, channelCount: 6, operationId: 'registerCaptureAudioInput', permission: 'CAPTURE_CONFIG' }],
      ['CAPTURE_AUDIO_INPUT_CHANGED', CALLER.operatorId, 'MIC-03', { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 4, channelCount: 6, operationId: 'registerCaptureAudioInput', permission: 'CAPTURE_CONFIG' }],
    ]);
    for (const text of DEVICE_TEXT) expect(written(r), text).not.toContain(text);

    // Operation 98 now names the input as registered, and counts it.
    r.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
    const search = await searchAudioCards(r.seams, CALLER);
    expect(search.cards.map((card) => card.registered)).toEqual([[{ inputNumber: 4, deviceId: 'MIC-03' }]]);
    expect(r.audits.at(-1)?.details).toMatchObject({ responderCount: 1, newCount: 0, registeredCount: 1 });
  });

  it('two inputs of one card are two microphones; the body states nothing but the key: the facts are the listing\'s', async () => {
    const r = rig(TWO_CARDS);
    const one = await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 });
    const two = await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 2 });
    expect([one.registration.deviceId, two.registration.deviceId]).toEqual(['MIC-03', 'MIC-04']);
    expect(r.inputs.map((input) => [input.deviceId, input.inputNumber, input.nativeChannels, input.sampleBits, input.usbId])).toEqual([
      ['MIC-03', 1, 2, 24, DUO.usbId],
      ['MIC-04', 2, 2, 24, DUO.usbId],
    ]);
    // The Core listed AGAIN for each registration: two readings of the host.
    expect(r.host.listings()).toBe(2);
  });

  it('the refusals, each storing nothing and writing no row: an unknown card (404), a device index the card does not have (404), an input beyond the card (409), a card whose count is a guess (409)', async () => {
    const r = rig(TWO_CARDS);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: 'NoSuchCard', deviceIndex: 0, inputNumber: 1 }))).toEqual([404, 'NOT_FOUND', null]);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 1, inputNumber: 1 }))).toEqual([404, 'NOT_FOUND', null]);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 3 }))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_BEYOND_CARD']);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 7 }))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_BEYOND_CARD']);
    r.host.use(ONBOARD_ONLY);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: ONBOARD.cardId, deviceIndex: 0, inputNumber: 1 }))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_NOT_REGISTRABLE']);
    r.host.use(NO_CARD);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 }))).toEqual([404, 'NOT_FOUND', null]);
    r.host.use(MALFORMED);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 }))).toEqual([404, 'NOT_FOUND', null]);
    expect(usbMicrophones(r.devices)).toEqual([]);
    expect(r.inputs).toEqual([]);
    expect(r.audits).toEqual([]);
    expect(r.admitted).toEqual([]);
  });

  it('the unit rolls back as a whole: a failed SECOND write leaves no device, no input, no audit row and no admission; the next registration takes the same id', async () => {
    const r = rig(ONE_INTERFACE);
    r.failNext('insertInput');
    await expect(registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 1 })).rejects.toMatchObject({ code: 'ROW070_INJECTED' });
    expect(usbMicrophones(r.devices)).toEqual([]);
    expect(r.inputs).toEqual([]);
    expect(r.audits).toEqual([]);
    expect(r.admitted).toEqual([]);
    // CONTROL: without the injected failure the same call stores both rows.
    expect((await registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 1 })).registration.deviceId).toBe('MIC-03');
    expect([usbMicrophones(r.devices), r.inputs.length, r.audits.length, r.admitted.length]).toEqual([['MIC-03'], 1, 1, 1]);
    // A re-enable whose second write fails changes nothing either.
    r.devices.set('MIC-03', { ...r.devices.get('MIC-03')!, enabled: false });
    r.failNext('refreshInput');
    await expect(registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 1 })).rejects.toMatchObject({ code: 'ROW070_INJECTED' });
    expect(r.devices.get('MIC-03')?.enabled).toBe(false);
    expect([r.audits.length, r.admitted.length]).toEqual([1, 1]);
  });

  it('AD-07 (4): another USB id behind the stored key is SAID as CARD_CHANGED (one entry, the stored facts follow), never a silent match and never a second device', async () => {
    const r = rig(ONE_INTERFACE);
    await registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 2 });
    r.host.use(INTERFACE_REPLACED);
    const changed = await registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 2 });
    expect(changed).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'CARD_CHANGED', inputNumber: 2, channelCount: 6 } });
    expect(usbMicrophones(r.devices)).toEqual(['MIC-03']);
    expect(r.inputs.map((input) => input.usbId)).toEqual(['fff0:0099']);
    expect(r.audits.map((row) => row.details?.['change'])).toEqual(['REGISTERED', 'CARD_CHANGED']);
    expect(written(r)).not.toContain('fff0:0099');
  });
});

describe('the refusals before any listing, and the listing gate', () => {
  it('no enumerator (a Core outside production capture): 503 NOT_READY / DISCOVERY_NOT_READY for both, nothing listed, stored or written', async () => {
    const r = rig(TWO_CARDS);
    r.withoutEnumerator();
    expect(await refusal(searchAudioCards(r.seams, CALLER))).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 }))).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
    expect([r.host.listings(), r.audits.length, r.inputs.length, r.failures.length]).toEqual([0, 0, 0, 0]);
  });

  it('no registrar of the registry row: operation 99 answers 503 before the host is read and stores nothing; operation 98 lists as before', async () => {
    const r = rig(TWO_CARDS);
    r.withoutRegistrar();
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 }))).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
    expect([r.host.listings(), r.audits.length, r.inputs.length, usbMicrophones(r.devices).length]).toEqual([0, 0, 0, 0]);
    expect((await searchAudioCards(r.seams, CALLER)).cards).toHaveLength(2);
  });

  it('a session is open: 409 CAPTURE_CONFIG_LOCKED for both, the host is not read and no row is written; a session that opens after the listing is refused inside the unit', async () => {
    const r = rig(TWO_CARDS);
    r.openSession(true);
    expect(await refusal(searchAudioCards(r.seams, CALLER))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 }))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect([r.host.listings(), r.audits.length, r.inputs.length]).toEqual([0, 0, 0]);
    r.openSession(false);
    r.openSessionInUnit();
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 }))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect(await refusal(searchAudioCards(r.seams, CALLER))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', null]);
    expect([usbMicrophones(r.devices), r.audits.length, r.inputs.length, r.admitted.length]).toEqual([[], 0, 0, 0]);
  });

  it('AD-07 (3): one listing at a time (a second call of either operation is 409 AUDIO_CARD_SEARCH_IN_PROGRESS and reads no host); a search within the spacing is 429 with retry-after; a registration is not spaced', async () => {
    const r = rig(TWO_CARDS);
    const release = r.host.holdOnce();
    const running = searchAudioCards(r.seams, CALLER);
    await Promise.resolve();
    expect(await refusal(searchAudioCards(r.seams, CALLER))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS']);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 }))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS']);
    expect(r.host.listings()).toBe(1);
    release();
    expect((await running).cards).toHaveLength(2);
    expect(r.seams.gate.started()).toBe(1);

    r.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS - 1_500);
    const limited = await searchAudioCards(r.seams, CALLER).catch((error: unknown) => error as ApiFailure);
    expect(limited).toBeInstanceOf(ApiFailure);
    expect([(limited as ApiFailure).statusCode, (limited as ApiFailure).code, (limited as ApiFailure).details, (limited as ApiFailure).headers]).toEqual([429, 'RATE_LIMITED', { reason: 'AUDIO_CARD_SEARCH_RATE_LIMITED', retryInMs: 1_500 }, { 'retry-after': '2' }]);
    expect(r.host.listings()).toBe(1);
    // A registration inside the spacing of the search lists (it is the Core's own second listing).
    expect((await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 })).created).toBe(true);
    r.advance(1_500);
    expect((await searchAudioCards(r.seams, CALLER)).cards).toHaveLength(2);
    expect(r.audits.map((row) => row.type)).toEqual(['CAPTURE_DISCOVERY_SEARCHED', 'CAPTURE_AUDIO_INPUT_CHANGED', 'CAPTURE_DISCOVERY_SEARCHED']);
  });

  it('the id of a listing: DSC- and thirteen digits of the clock; two listings of one millisecond never share one', () => {
    const next = createAudioCardSearchIds();
    expect([next(START), next(START), next(START + 5), next(START - 60_000)]).toEqual([`DSC-${START}`, `DSC-${START + 1}`, `DSC-${START + 5}`, `DSC-${START + 6}`]);
    expect(next(7)).toMatch(/^DSC-\d{13}$/);
  });
});
