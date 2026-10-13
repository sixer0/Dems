// The service of operations 98 and 99, without a database (task 4 blueprint row 70, WP-07c).
//
// WHAT IS REAL: `searchAudioCards`, `registerAudioInput`, the listing gate, the search ids, and the
// enumerator of row 64 with its parser. WHAT IS A STAND-IN: the host (a clock of this file, a unit
// of work that keeps a copy of the stored rows and puts it back when the work throws), the store
// and the registrar (two maps in the place of `capture_devices` and `capture_audio_inputs`) and the source of the
// listing text (`fixtures.ts`). The statements and the real unit are `routes.db.test.ts`.
import {
  CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS,
  CAPTURE_DISCOVERY_MAX_PER_MINUTE,
  CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS,
  CaptureAudioCardSearchSchema,
  CaptureAudioInputRegistrationSchema,
} from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../../../../core';
import { ApiFailure } from '../../../../plugins/error-envelope';
import { createAudioCardSearchIds } from '../index';
import type { EngineUnit } from '../../../../engine';
import { createListingGate, matchStoredCard, registerAudioInput, searchAudioCards, type AudioCardsCaller, type AudioCardsSeams, type MicrophoneRegistrar, type RegisteredMicrophone } from '../service';
import { INSERT_AUDIO_INPUT, READ_AUDIO_INPUT_OF_CARD, READ_REGISTERED_AUDIO_INPUTS, REFRESH_AUDIO_INPUT } from '../statements';
import { cardIdentityText, cardIdentityValuesOf, createMicrophoneStore, type MicrophoneStore } from '../store';
import {
  DUO,
  DUO_PORT,
  INTERFACE_ON_ANOTHER_PORT,
  INTERFACE_OTHER_UNIT_ELSEWHERE,
  INTERFACE_OTHER_UNIT_SAME_PORT,
  INTERFACE_REPLACED,
  INTERFACE_WITH_SERIAL,
  INTERFACE_WITH_SERIAL_MOVED,
  INTERFACE_WITHOUT_PORT,
  OTHER_SERIAL,
  SIX_SERIAL,
  TWO_SHARING_A_SERIAL,
  TWO_SHARING_A_SERIAL_SWAPPED,
  MALFORMED,
  NO_CARD,
  ONBOARD,
  ONBOARD_ONLY,
  ONE_INTERFACE,
  OTHER_PORT,
  SIX,
  SIX_PORT,
  SIX_SECOND_CARD_ID,
  TWO_CARDS,
  TWO_OF_ONE_PRODUCT,
  TWO_OF_ONE_PRODUCT_SWAPPED,
  fakeHost,
  type FakeHost,
  type HostTexts,
} from './fixtures';

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
  /** The serial and the port path stored with an input, by microphone. */
  readonly identities: Map<string, { usbSerial: string | null; usbPort: string | null }>;
  /** The microphones the registrar was asked to enable again, in order. */
  readonly reenables: string[];
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

/**
 * `storesIdentity: false` is THE STORE OF BEFORE SCHEMA SET B (task 4 rows 156, 192): its rows hold
 * a USB id and neither a serial nor a port path, as every row written before the two columns
 * existed. The default is the store of the product since row 199: it holds both.
 */
function rig(texts: HostTexts, options: { readonly storesIdentity?: boolean } = {}): Rig {
  const storesIdentity = options.storesIdentity !== false;
  /** The serial and the port path stored with an input, by microphone: beside `inputs`, whose rows keep the columns of the table of row 70. */
  const identities = new Map<string, { usbSerial: string | null; usbPort: string | null }>();
  const identityOf = (input: StoredInput) => ({ usbId: input.usbId, usbSerial: storesIdentity ? (identities.get(input.deviceId)?.usbSerial ?? null) : null, usbPort: storesIdentity ? (identities.get(input.deviceId)?.usbPort ?? null) : null });
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
  /** Every call of the registrar's re-enable, by microphone (row 199: a card that is not the stored one re-enables none). */
  const reenables: string[] = [];
  const trip =(member: keyof MicrophoneStore | keyof MicrophoneRegistrar): void => {
    if (failing !== member) return;
    failing = null;
    throw Object.assign(new Error(`row070: a failure injected in ${member}`), { code: 'ROW070_INJECTED' });
  };
  const store: MicrophoneStore = {
    async registeredInputs() {
      trip('registeredInputs');
      return inputs.map((input) => ({ deviceId: input.deviceId, cardId: input.cardId, cardDevice: input.cardDevice, inputNumber: input.inputNumber, identity: identityOf(input) }));
    },
    async inputOf(_db, key) {
      trip('inputOf');
      const found = inputs.find((input) => input.cardId === key.cardId && input.cardDevice === key.cardDevice && input.inputNumber === key.inputNumber);
      return found === undefined ? null : { deviceId: found.deviceId, ...identityOf(found), enabled: devices.get(found.deviceId)?.enabled === true };
    },
    async insertInput(_db, input) {
      trip('insertInput');
      const { usbPort, usbSerial, ...row } = input;
      inputs.push({ ...row });
      identities.set(input.deviceId, { usbSerial: usbSerial ?? null, usbPort: usbPort ?? null });
    },
    async refreshInput(_db, input) {
      trip('refreshInput');
      const held = inputs.find((entry) => entry.deviceId === input.deviceId);
      if (held === undefined) throw new Error('row070: no such input');
      Object.assign(held, { usbId: input.usbId, nativeChannels: input.nativeChannels, sampleBits: input.sampleBits, operatorId: input.operatorId, at: input.at });
      identities.set(input.deviceId, { usbSerial: input.usbSerial ?? null, usbPort: input.usbPort ?? null });
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
      reenables.push(device.deviceId);
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
        const before = { devices: structuredClone([...devices]), inputs: structuredClone(inputs), audits: audits.length, identities: structuredClone([...identities]), reenables: reenables.length };
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
          identities.clear();
          for (const [id, identity] of before.identities) identities.set(id, identity);
          reenables.splice(before.reenables);
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
    identities,
    reenables,
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
        // Row V3's contract members (the request of rows 199 / 200): the port each card sits on; neither states a serial.
        { cardId: DUO.cardId, deviceIndex: 0, usbId: DUO.usbId, usbSerial: null, usbPort: DUO_PORT, product: DUO.product, channelCount: 2, sampleBits: [24], registered: [] },
        { cardId: SIX.cardId, deviceIndex: 0, usbId: SIX.usbId, usbSerial: null, usbPort: SIX_PORT, product: SIX.product, channelCount: 6, sampleBits: [24], registered: [] },
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

  it('`usbSerial` and `usbPort` are answered as the contract states them: the listing\'s text in the closed form, null for a card that states none or is not USB, null for a text outside the form - never cut; and in no audit row or note', async () => {
    const identityOf = async (texts: HostTexts): Promise<unknown[]> => {
      const r = rig(texts);
      const answer = await searchAudioCards(r.seams, CALLER);
      expect(CaptureAudioCardSearchSchema.safeParse(answer).success).toBe(true);
      // The two values are the answer's alone: no audit row and no note of the listing carries either.
      for (const text of [SIX_SERIAL, OTHER_SERIAL, SIX_PORT, OTHER_PORT]) expect(written(r), text).not.toContain(text);
      return answer.cards.map((card) => [card.cardId, card.usbSerial, card.usbPort]);
    };
    // Two same-model cards that state one serial: the port tells a console which row is which.
    expect(await identityOf(TWO_SHARING_A_SERIAL)).toEqual([[SIX.cardId, SIX_SERIAL, SIX_PORT], [SIX_SECOND_CARD_ID, SIX_SERIAL, OTHER_PORT]]);
    expect(await identityOf(INTERFACE_OTHER_UNIT_ELSEWHERE)).toEqual([[SIX.cardId, OTHER_SERIAL, OTHER_PORT]]);
    // A serial and no port (the system offers none); neither (a card that is not USB): null, never an empty text.
    expect(await identityOf({ ...INTERFACE_WITHOUT_PORT, serials: { 2: `${SIX_SERIAL}\n` } })).toEqual([[SIX.cardId, SIX_SERIAL, null]]);
    expect(await identityOf(ONBOARD_ONLY)).toEqual([[ONBOARD.cardId, null, null]]);

    // THE ANSWER'S OWN BOUND, behind the listing's: an enumerator that hands texts outside the closed form (a space, a
    // slash, 65 characters, the empty text) is answered null for each - the text is not cut to fit and not repaired.
    const r = rig(ONE_INTERFACE);
    const listing = await r.host.enumerator.list();
    const card = listing.cards[0];
    if (card === undefined) throw new Error('the fixture lists one card');
    const outside = ['SN 0001', 'usb/1-2', 'A'.repeat(65), ''];
    const handed = { ...r.seams, enumerator: () => ({ list: async () => ({ ...listing, cards: outside.flatMap((text, index) => [{ ...card, deviceIndex: index, usbSerial: text, usbPort: text }]) }) }) };
    const bounded = await searchAudioCards(handed, CALLER);
    expect(CaptureAudioCardSearchSchema.safeParse(bounded).success).toBe(true);
    expect(bounded.cards.map((entry) => [entry.usbSerial, entry.usbPort])).toEqual(outside.map(() => [null, null]));
    // The longest text of the form is answered whole.
    const longest = 'A'.repeat(64);
    const whole = await searchAudioCards({ ...rig(ONE_INTERFACE).seams, enumerator: () => ({ list: async () => ({ ...listing, cards: [{ ...card, usbSerial: longest, usbPort: longest }] }) }) }, CALLER);
    expect(whole.cards.map((entry) => [entry.usbSerial, entry.usbPort])).toEqual([[longest, longest]]);
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

// Task 4 row 156 (AD-07 (4)): the match of a stored input to a live card follows the identity
// rule - the USB id and the USB port path where the system offers one. The double: the real
// enumerator over fixed host texts that differ in the port path only.
describe('row 156: the identity of the card behind a stored input (USB id and port path)', () => {
  const KEY = { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 2 } as const;
  const changes = (r: Rig) => r.audits.filter((row) => row.type === 'CAPTURE_AUDIO_INPUT_CHANGED').map((row) => row.details?.['change']);
  const matchNotes = (r: Rig) => (r.notes as Array<Record<string, unknown>>).filter((note) => note['code'] === 'CAPTURE_AUDIO_INPUT_CHANGED').map((note) => note['match'] ?? null);

  it('a card of the same product on ANOTHER PORT is CARD_CHANGED with ONE audit entry - no silent match, no second device, no device text written', async () => {
    const r = rig(ONE_INTERFACE);
    await registerAudioInput(r.seams, CALLER, KEY);
    // The same card id, device index, USB id and product; another port path.
    r.host.use(INTERFACE_ON_ANOTHER_PORT);
    const moved = await registerAudioInput(r.seams, CALLER, KEY);
    expect(moved).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'CARD_CHANGED', inputNumber: 2, channelCount: 6 } });
    expect(changes(r)).toEqual(['REGISTERED', 'CARD_CHANGED']);
    expect(matchNotes(r)).toEqual([null, 'PORT_DIFFERS']);
    expect(usbMicrophones(r.devices)).toEqual(['MIC-03']);
    expect(r.inputs).toHaveLength(1);
    // The six closed keys of the entry, and no port, USB id or product anywhere it is written.
    expect(Object.keys(r.audits.at(-1)?.details ?? {}).sort()).toEqual(['change', 'channelCount', 'deviceId', 'inputNumber', 'operationId', 'permission']);
    for (const text of [SIX_PORT, OTHER_PORT, ...DEVICE_TEXT]) expect(written(r)).not.toContain(text);
    // Row 199: the registrar's re-enable was NOT called for the card that is not the stored one.
    expect(r.reenables).toEqual([]);
    // The stored port FOLLOWS the change (it was said once): the same card again is a plain re-enable.
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
    expect(r.reenables).toEqual(['MIC-03']);
    expect(changes(r)).toEqual(['REGISTERED', 'CARD_CHANGED', 'REENABLED']);
    expect(matchNotes(r).at(-1)).toBe('SAME_CARD');
  });

  it('CONTROL: the same card on the same port is REENABLED; a second card of the product beside it changes nothing, because the port says which is which', async () => {
    const r = rig(ONE_INTERFACE);
    await registerAudioInput(r.seams, CALLER, KEY);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
    r.host.use(TWO_OF_ONE_PRODUCT);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
    expect(matchNotes(r)).toEqual([null, 'SAME_CARD', 'SAME_CARD']);
    // The two cards of one product exchanged their ports: behind the stored key sits the OTHER card.
    r.host.use(TWO_OF_ONE_PRODUCT_SWAPPED);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('CARD_CHANGED');
    expect(matchNotes(r).at(-1)).toBe('PORT_DIFFERS');
    expect(usbMicrophones(r.devices)).toEqual(['MIC-03']);
  });

  it('the second card of the product, under its own key, is a NEW microphone - never the registered one', async () => {
    const r = rig(TWO_OF_ONE_PRODUCT);
    await registerAudioInput(r.seams, CALLER, KEY);
    const second = await registerAudioInput(r.seams, CALLER, { ...KEY, cardId: SIX_SECOND_CARD_ID });
    expect(second).toMatchObject({ created: true, registration: { deviceId: 'MIC-04', change: 'REGISTERED' } });
    expect(usbMicrophones(r.devices)).toEqual(['MIC-03', 'MIC-04']);
    const search = await searchAudioCards(r.seams, CALLER);
    expect(search.cards.map((card) => [card.cardId, card.registered])).toEqual([
      [SIX.cardId, [{ inputNumber: 2, deviceId: 'MIC-03' }]],
      [SIX_SECOND_CARD_ID, [{ inputNumber: 2, deviceId: 'MIC-04' }]],
    ]);
  });

  // TURNED BY ROW 199 (was: "one card of the USB id matches by the USB id; two cards of it are NOT
  // TELLABLE"). The USB id alone identifies no card any more: a row that holds neither a serial nor
  // a port path - every row written before schema set B - is IDENTITY_NOT_STORED, said as
  // CARD_CHANGED, and the STATED GAP of row 156 (the same product on another port, alone on the
  // host, re-enabled silently) is closed.
  it('where NO identity is stored (a row of before the two columns): the USB id alone matches NO card - said as CARD_CHANGED, not enabled again, and the registration then stores the identity', async () => {
    const before = rig(ONE_INTERFACE, { storesIdentity: false });
    await registerAudioInput(before.seams, CALLER, KEY);
    before.devices.set('MIC-03', { ...before.devices.get('MIC-03')!, enabled: false });
    // The same card on the same port: it cannot be KNOWN to be the same, so it is not taken as the same.
    expect((await registerAudioInput(before.seams, CALLER, KEY)).registration.change).toBe('CARD_CHANGED');
    // THE GAP OF ROW 156, CLOSED: the same product on another port, alone on the host.
    before.host.use(INTERFACE_ON_ANOTHER_PORT);
    expect((await registerAudioInput(before.seams, CALLER, KEY)).registration.change).toBe('CARD_CHANGED');
    before.host.use(TWO_OF_ONE_PRODUCT);
    expect((await registerAudioInput(before.seams, CALLER, KEY)).registration.change).toBe('CARD_CHANGED');
    expect(matchNotes(before)).toEqual([null, 'IDENTITY_NOT_STORED', 'IDENTITY_NOT_STORED', 'IDENTITY_NOT_STORED']);
    // Nothing was enabled again, no second device, one entry per call; the search offers the card as NEW.
    expect([before.reenables, before.devices.get('MIC-03')?.enabled, usbMicrophones(before.devices), changes(before)]).toEqual([[], false, ['MIC-03'], ['REGISTERED', 'CARD_CHANGED', 'CARD_CHANGED', 'CARD_CHANGED']]);
    before.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
    expect((await searchAudioCards(before.seams, CALLER)).cards.map((card) => card.registered)).toEqual([[], []]);
    // A LIVE card that offers neither a serial nor a port could be found again by nothing: refused, nothing stored, nothing said.
    const offered = rig(ONE_INTERFACE);
    await registerAudioInput(offered.seams, CALLER, KEY);
    offered.host.use(INTERFACE_WITHOUT_PORT);
    expect(await refusal(registerAudioInput(offered.seams, CALLER, KEY))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_NOT_REGISTRABLE']);
    expect(await refusal(registerAudioInput(offered.seams, CALLER, { ...KEY, inputNumber: 5 }))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_NOT_REGISTRABLE']);
    expect([changes(offered), offered.reenables, offered.identities.get('MIC-03'), usbMicrophones(offered.devices)]).toEqual([['REGISTERED'], [], { usbSerial: null, usbPort: SIX_PORT }, ['MIC-03']]);
  });

  // TURNED BY ROW 199: the table of row 156 with the serial before the port. The rows that changed
  // are marked; every other row answers what it answered.
  it('the rule itself, as a table: the USB id first, then the SERIAL, else the port; never the product, never the card id or the USB id alone', () => {
    type Live = Parameters<typeof matchStoredCard>[1];
    const live = (over: Partial<Live> = {}): Live => ({ cardId: 'Card', deviceIndex: 0, usbId: 'fff0:0006', usbPort: 'p-1', product: 'P', channelCount: 2, factsSource: 'STREAM', sampleBits: [24], ...over });
    const card = live();
    const twin = live({ cardId: 'Card_1', usbPort: 'p-2' });
    const serialled = live({ usbSerial: 'SN-A' });
    const table: Array<[string, Parameters<typeof matchStoredCard>[0], Live, Parameters<typeof matchStoredCard>[2], string]> = [
      // ── as in row 156 ──
      ['same id, same port', { usbId: 'fff0:0006', usbPort: 'p-1' }, card, [card], 'SAME_CARD'],
      ['same id, same port, a twin beside it', { usbId: 'fff0:0006', usbPort: 'p-1' }, card, [card, twin], 'SAME_CARD'],
      ['same id, another port', { usbId: 'fff0:0006', usbPort: 'p-9' }, card, [card], 'PORT_DIFFERS'],
      ['another id, same port', { usbId: 'fff0:0099', usbPort: 'p-1' }, card, [card], 'USB_ID_DIFFERS'],
      ['a stored id, a live card without one', { usbId: 'fff0:0006', usbPort: 'p-1' }, live({ usbId: null, usbPort: null }), [card], 'USB_ID_DIFFERS'],
      ['two capture devices of ONE card are not two cards', { usbId: 'fff0:0006', usbPort: 'p-1' }, card, [card, live({ deviceIndex: 1 })], 'SAME_CARD'],
      ['not a USB card on either side: the key is all it has', { usbId: null }, live({ usbId: null, usbPort: null }), [live({ usbId: null, usbPort: null }), live({ cardId: 'Other', usbId: null, usbPort: null })], 'SAME_CARD'],
      // ── TURNED: no stored identity is no match (was SAME_CARD by the USB id, or NOT_TELLABLE beside a twin) ──
      ['no stored port, one card of the id', { usbId: 'fff0:0006' }, card, [card], 'IDENTITY_NOT_STORED'],
      ['a null stored port, one card of the id', { usbId: 'fff0:0006', usbPort: null }, card, [card], 'IDENTITY_NOT_STORED'],
      ['an empty stored port is no port', { usbId: 'fff0:0006', usbPort: '' }, card, [card, twin], 'IDENTITY_NOT_STORED'],
      ['no stored port, two cards of the id', { usbId: 'fff0:0006' }, card, [card, twin], 'IDENTITY_NOT_STORED'],
      ['no stored identity, a live card with a serial', { usbId: 'fff0:0006', usbSerial: null, usbPort: null }, serialled, [serialled], 'IDENTITY_NOT_STORED'],
      // ── TURNED: a stored port the live card cannot be held against (was NOT_TELLABLE beside a twin, SAME_CARD alone) ──
      ['a stored port, no live port, two cards of the id', { usbId: 'fff0:0006', usbPort: 'p-1' }, live({ usbPort: null }), [card, twin], 'PORT_DIFFERS'],
      ['a stored port, no live port, one card of the id', { usbId: 'fff0:0006', usbPort: 'p-1' }, live({ usbPort: null }), [live({ usbPort: null })], 'PORT_DIFFERS'],
      // ── NEW: the serial ──
      ['the stored serial on the stored port', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-1' }, serialled, [serialled], 'SAME_CARD'],
      ['THE STORED SERIAL ON ANOTHER PORT: the card was moved, it is the card', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-9' }, serialled, [serialled], 'SAME_CARD'],
      ['the stored serial, no live port at all', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-1' }, live({ usbSerial: 'SN-A', usbPort: null }), [live({ usbSerial: 'SN-A', usbPort: null })], 'SAME_CARD'],
      ['a serial stored and no port stored', { usbId: 'fff0:0006', usbSerial: 'SN-A' }, serialled, [serialled], 'SAME_CARD'],
      ['ANOTHER SERIAL ON THE STORED PORT: another unit in the same socket', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-1' }, live({ usbSerial: 'SN-B' }), [live({ usbSerial: 'SN-B' })], 'SERIAL_DIFFERS'],
      ['another serial on another port', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-1' }, live({ usbSerial: 'SN-B', usbPort: 'p-2' }), [live({ usbSerial: 'SN-B', usbPort: 'p-2' })], 'SERIAL_DIFFERS'],
      ['a serial of another case is another serial', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-1' }, live({ usbSerial: 'sn-a' }), [live({ usbSerial: 'sn-a' })], 'SERIAL_DIFFERS'],
      ['A SERIAL WAS STORED, THE LIVE CARD STATES NONE (same port)', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-1' }, card, [card], 'SERIAL_DIFFERS'],
      ['NO SERIAL WAS STORED, THE LIVE CARD STATES ONE (same port)', { usbId: 'fff0:0006', usbSerial: null, usbPort: 'p-1' }, serialled, [serialled], 'SERIAL_DIFFERS'],
      ['an empty serial is no serial', { usbId: 'fff0:0006', usbSerial: '', usbPort: 'p-1' }, live({ usbSerial: '' }), [card], 'SAME_CARD'],
      ['the stored serial, the twin beside it states another', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-9' }, serialled, [serialled, live({ cardId: 'Card_1', usbSerial: 'SN-B', usbPort: 'p-2' })], 'SAME_CARD'],
      // ── NEW: two live cards that state the SAME serial - then the port must say which ──
      ['a shared serial, the stored port', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-1' }, serialled, [serialled, live({ cardId: 'Card_1', usbSerial: 'SN-A', usbPort: 'p-2' })], 'SAME_CARD'],
      ['a shared serial, another port', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-2' }, serialled, [serialled, live({ cardId: 'Card_1', usbSerial: 'SN-A', usbPort: 'p-2' })], 'NOT_TELLABLE'],
      ['a shared serial, no stored port', { usbId: 'fff0:0006', usbSerial: 'SN-A' }, serialled, [serialled, live({ cardId: 'Card_1', usbSerial: 'SN-A', usbPort: 'p-2' })], 'NOT_TELLABLE'],
      ['a shared serial on two capture devices of ONE card is one card', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-9' }, serialled, [serialled, live({ deviceIndex: 1, usbSerial: 'SN-A' })], 'SAME_CARD'],
    ];
    for (const [name, stored, liveCard, listing, expected] of table) expect(matchStoredCard(stored, liveCard, listing), name).toBe(expected);
    // The product is no part of the rule: another product text on the same id and port is the same card.
    expect(matchStoredCard({ usbId: 'fff0:0006', usbPort: 'p-1' }, live({ product: 'Another name' }), [card])).toBe('SAME_CARD');
    console.info(`[row199] the identity rule | rows of the table=${table.length} answers=${[...new Set(table.map((row) => row[4]))].sort().join(',')}`);
  });
});

// Task 4 row 199 (follow-up of row 192; findings of rows 67 and 156; AD-07 (4)): the registration
// STORES the serial and the port path of the Core's own listing, and the match reads them.
// THE DOUBLE: the real enumerator and parser over fixed host texts (`fixtures.ts`: a serial is the
// one line of the kernel's attribute, by card index); the store is the two maps of this file. The
// statements and the columns are measured on PostgreSQL in `routes.db.test.ts`.
describe('row 199: the serial and the port path are stored, and a stored input matches a live card by serial, else by port path', () => {
  const KEY = { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 2 } as const;
  const changes = (r: Rig) => r.audits.filter((row) => row.type === 'CAPTURE_AUDIO_INPUT_CHANGED').map((row) => row.details?.['change']);
  const matchNotes = (r: Rig) => (r.notes as Array<Record<string, unknown>>).filter((note) => note['code'] === 'CAPTURE_AUDIO_INPUT_CHANGED').map((note) => note['match'] ?? null);
  const off = (r: Rig): void => void r.devices.set('MIC-03', { ...r.devices.get('MIC-03')!, enabled: false });

  it('a registration hands BOTH values of the listing to the store: the serial where the card states one, null where it states none; the port path of every USB card', async () => {
    const withSerial = rig(INTERFACE_WITH_SERIAL);
    await registerAudioInput(withSerial.seams, CALLER, KEY);
    expect(withSerial.identities.get('MIC-03')).toEqual({ usbSerial: SIX_SERIAL, usbPort: SIX_PORT });
    const without = rig(ONE_INTERFACE);
    await registerAudioInput(without.seams, CALLER, KEY);
    expect(without.identities.get('MIC-03')).toEqual({ usbSerial: null, usbPort: SIX_PORT });
    // Neither value is logged or audited: the entry is what it was. Since row V3's contract step both ARE answered by
    // operation 98 (the request of rows 199 / 200): the serial the card states, or null, and its port.
    for (const r of [withSerial, without]) for (const text of [SIX_SERIAL, SIX_PORT]) expect(written(r)).not.toContain(text);
    expect((await searchAudioCards(withSerial.seams, CALLER)).cards.map((card) => [card.usbSerial, card.usbPort])).toEqual([[SIX_SERIAL, SIX_PORT]]);
    expect((await searchAudioCards(without.seams, CALLER)).cards.map((card) => [card.usbSerial, card.usbPort])).toEqual([[null, SIX_PORT]]);
  });

  it('WITHOUT a serial, on its stored port: the same card - REENABLED, the microphone on again', async () => {
    const r = rig(ONE_INTERFACE);
    await registerAudioInput(r.seams, CALLER, KEY);
    off(r);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
    expect([matchNotes(r), r.reenables, r.devices.get('MIC-03')?.enabled]).toEqual([[null, 'SAME_CARD'], ['MIC-03'], true]);
  });

  it('THE STORED SERIAL ON ANOTHER PORT: the same card, moved - REENABLED, and the stored port follows', async () => {
    const r = rig(INTERFACE_WITH_SERIAL);
    await registerAudioInput(r.seams, CALLER, KEY);
    off(r);
    r.host.use(INTERFACE_WITH_SERIAL_MOVED);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
    expect([matchNotes(r), r.reenables, r.devices.get('MIC-03')?.enabled, r.identities.get('MIC-03')]).toEqual([[null, 'SAME_CARD'], ['MIC-03'], true, { usbSerial: SIX_SERIAL, usbPort: OTHER_PORT }]);
  });

  it('A SAME-PRODUCT CARD WITH NO MATCHING SERIAL ON ANOTHER PORT is CARD_CHANGED with 1 audit entry and 0 re-enabled rows; operation 98 offers it as a NEW card; registered by the technician, the same call again is REENABLED', async () => {
    for (const [name, registeredOn, swapped, match] of [
      ['no serial on either side, another port', ONE_INTERFACE, INTERFACE_ON_ANOTHER_PORT, 'PORT_DIFFERS'],
      ['another serial on another port', INTERFACE_WITH_SERIAL, INTERFACE_OTHER_UNIT_ELSEWHERE, 'SERIAL_DIFFERS'],
      ['another serial on the SAME port', INTERFACE_WITH_SERIAL, INTERFACE_OTHER_UNIT_SAME_PORT, 'SERIAL_DIFFERS'],
      ['a serial was stored, the card on another port states none', INTERFACE_WITH_SERIAL, INTERFACE_ON_ANOTHER_PORT, 'SERIAL_DIFFERS'],
      ['a serial was stored, the card on the SAME port states none', INTERFACE_WITH_SERIAL, ONE_INTERFACE, 'SERIAL_DIFFERS'],
      ['no serial was stored, the card on the same port states one', ONE_INTERFACE, INTERFACE_WITH_SERIAL, 'SERIAL_DIFFERS'],
    ] as const) {
      const r = rig(registeredOn);
      await registerAudioInput(r.seams, CALLER, KEY);
      off(r);
      r.host.use(swapped);
      // Operation 98, before anything is registered against it: the card is listed with NO registered input.
      r.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
      const offered = await searchAudioCards(r.seams, CALLER);
      expect(offered.cards.map((card) => [card.cardId, card.registered]), name).toEqual([[SIX.cardId, []]]);
      expect(r.audits.at(-1)?.details, name).toMatchObject({ responderCount: 1, newCount: 1, registeredCount: 0 });
      // Operation 99 against it: said, ONE entry, the microphone NOT enabled again, no second device.
      const audits = r.audits.length;
      const changed = await registerAudioInput(r.seams, CALLER, KEY);
      expect(changed, name).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'CARD_CHANGED', inputNumber: 2, channelCount: 6 } });
      expect(r.audits.slice(audits).map((row) => [row.type, row.details?.['change']]), name).toEqual([['CAPTURE_AUDIO_INPUT_CHANGED', 'CARD_CHANGED']]);
      expect([r.reenables, r.devices.get('MIC-03')?.enabled, usbMicrophones(r.devices), r.inputs.length, matchNotes(r).at(-1)], name).toEqual([[], false, ['MIC-03'], 1, match]);
      for (const text of [SIX_SERIAL, OTHER_SERIAL, SIX_PORT, OTHER_PORT, ...DEVICE_TEXT]) expect(written(r), `${name} / ${text}`).not.toContain(text);
      // The technician registered it: the stored identity names THIS card, and the same call again enables the microphone.
      expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change, name).toBe('REENABLED');
      expect([r.reenables, r.devices.get('MIC-03')?.enabled, changes(r)], name).toEqual([['MIC-03'], true, ['REGISTERED', 'CARD_CHANGED', 'REENABLED']]);
    }
  });

  it('a microphone that was ON stays on through a CARD_CHANGED (nothing is switched off here), and is not written by the registrar', async () => {
    const r = rig(INTERFACE_WITH_SERIAL);
    await registerAudioInput(r.seams, CALLER, KEY);
    const before = structuredClone(r.devices.get('MIC-03'));
    r.advance(1_000);
    r.host.use(INTERFACE_OTHER_UNIT_ELSEWHERE);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('CARD_CHANGED');
    expect([r.devices.get('MIC-03'), r.reenables]).toEqual([before, []]);
    expect(r.identities.get('MIC-03')).toEqual({ usbSerial: OTHER_SERIAL, usbPort: OTHER_PORT });
  });

  it('two cards that state the SAME serial: the port path says which is the registered one; with their ports exchanged it is CARD_CHANGED, never a guess', async () => {
    const r = rig(TWO_SHARING_A_SERIAL);
    await registerAudioInput(r.seams, CALLER, KEY);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
    r.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
    expect((await searchAudioCards(r.seams, CALLER)).cards.map((card) => [card.cardId, card.registered.length])).toEqual([[SIX.cardId, 1], [SIX_SECOND_CARD_ID, 0]]);
    r.host.use(TWO_SHARING_A_SERIAL_SWAPPED);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('CARD_CHANGED');
    expect(matchNotes(r)).toEqual([null, 'SAME_CARD', 'NOT_TELLABLE']);
    expect(r.reenables).toEqual(['MIC-03']);
  });

  it('the store binds the three identity values in the order of the statements, and a serial or port outside the closed form is bound and read as NULL, never as it came', async () => {
    const facts = { deviceId: 'MIC-03', usbId: 'fff0:0006', nativeChannels: 6, sampleBits: 24, operatorId: 'OP-0003', at: 1 } as const;
    expect(cardIdentityValuesOf({ ...facts, usbSerial: 'SN-A', usbPort: '0000:00:14.0-3.1' })).toEqual(['fff0:0006', 'SN-A', '0000:00:14.0-3.1']);
    expect(cardIdentityValuesOf(facts)).toEqual(['fff0:0006', null, null]);
    for (const bad of ['SN 0001', 'SN;rm', '', 'S'.repeat(65), 'Série', '<b>', 'a\nb', '../x']) {
      expect(cardIdentityValuesOf({ ...facts, usbSerial: bad, usbPort: bad }), JSON.stringify(bad)).toEqual(['fff0:0006', null, null]);
      expect(cardIdentityText(bad)).toBeNull();
    }
    for (const value of [undefined, null, 7, {}]) expect(cardIdentityText(value)).toBeNull();
    expect(cardIdentityText('S'.repeat(64))).toBe('S'.repeat(64));
    // The real store against a connection that records: the placeholders and the values, statement by statement.
    const calls: Array<[string, unknown[] | undefined]> = [];
    const rows: Record<string, unknown>[] = [{ deviceId: 'MIC-03', cardId: 'DemsSix', cardDevice: 0, inputNumber: 2, usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'not a port', enabled: true }];
    const connection = { query: async (text: string, values?: unknown[]) => (calls.push([text, values]), { rows: rows as never[], rowCount: 1 }) };
    const real = createMicrophoneStore();
    await real.insertInput(connection, { ...facts, usbSerial: 'SN-A', usbPort: 'p-1', cardId: 'DemsSix', cardDevice: 0, inputNumber: 2 });
    await real.refreshInput(connection, { ...facts, usbSerial: null, usbPort: 'p-2' });
    expect(calls).toEqual([
      [INSERT_AUDIO_INPUT, ['MIC-03', 'fff0:0006', 'SN-A', 'p-1', 'DemsSix', 0, 2, 6, 24, 'OP-0003', 1]],
      [REFRESH_AUDIO_INPUT, ['MIC-03', 'fff0:0006', null, 'p-2', 6, 24, 'OP-0003', 1]],
    ]);
    expect([INSERT_AUDIO_INPUT.match(/\$\d+/g)?.length, REFRESH_AUDIO_INPUT.match(/\$\d+/g)?.length]).toEqual([11, 8]);
    for (const statement of [INSERT_AUDIO_INPUT, REFRESH_AUDIO_INPUT, READ_AUDIO_INPUT_OF_CARD, READ_REGISTERED_AUDIO_INPUTS]) expect(statement).toMatch(/usb_id.*usb_serial.*usb_port/);
    // Read back: a stored value outside the closed form (it cannot be there: the CHECK) is still read as none.
    expect(await real.inputOf(connection, { cardId: 'DemsSix', cardDevice: 0, inputNumber: 2 })).toEqual({ deviceId: 'MIC-03', usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: null, enabled: true });
    expect(await real.registeredInputs(connection)).toEqual([{ deviceId: 'MIC-03', cardId: 'DemsSix', cardDevice: 0, inputNumber: 2, identity: { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: null } }]);
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

  it('row 156, AD-07 (3): concurrent searches start ONE process - of two, and of five, begun in the same turn, one lists and the others are refused 409 without reading the host', async () => {
    const r = rig(TWO_CARDS);
    const release = r.host.holdOnce();
    const [first, second] = [searchAudioCards(r.seams, CALLER), searchAudioCards(r.seams, CALLER)];
    expect(await refusal(second)).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS']);
    expect([r.host.listings(), r.seams.gate.started()]).toEqual([1, 1]);
    release();
    expect((await first).cards).toHaveLength(2);
    // Five at once, a minute later: still one process, one audit row.
    r.advance(60_000);
    const releaseFive = r.host.holdOnce();
    const five = Array.from({ length: 5 }, () => searchAudioCards(r.seams, CALLER));
    const refusals = await Promise.all(five.slice(1).map((pending) => refusal(pending)));
    expect(refusals).toEqual(Array.from({ length: 4 }, () => [409, 'INVALID_STATE', 'AUDIO_CARD_SEARCH_IN_PROGRESS']));
    releaseFive();
    await five[0];
    expect([r.host.listings(), r.seams.gate.started()]).toEqual([2, 2]);
    expect(r.audits.map((row) => row.type)).toEqual(['CAPTURE_DISCOVERY_SEARCHED', 'CAPTURE_DISCOVERY_SEARCHED']);
    // A refused call counted nothing: the next search after the spacing is let through.
    r.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
    expect((await searchAudioCards(r.seams, CALLER)).cards).toHaveLength(2);
  });

  it('row 156, AD-07 (3): spaced like the camera search per Core - 5 s between two searches AND at most six accepted searches in a minute; the seventh waits for the first to leave the minute', async () => {
    expect([CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS, CAPTURE_DISCOVERY_MAX_PER_MINUTE]).toEqual([CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS, 6]);
    const r = rig(TWO_CARDS);
    // Six searches, 5 s apart: t = 0, 5, ..., 25 s.
    for (let index = 0; index < CAPTURE_DISCOVERY_MAX_PER_MINUTE; index += 1) {
      if (index > 0) r.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
      expect((await searchAudioCards(r.seams, CALLER)).cards).toHaveLength(2);
    }
    // t = 30 s: the spacing is kept, the minute is full. Refused with the time until the first search is a minute old.
    r.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
    const limited = await searchAudioCards(r.seams, CALLER).catch((error: unknown) => error as ApiFailure);
    expect(limited).toBeInstanceOf(ApiFailure);
    expect([(limited as ApiFailure).statusCode, (limited as ApiFailure).code, (limited as ApiFailure).details, (limited as ApiFailure).headers]).toEqual([429, 'RATE_LIMITED', { reason: 'AUDIO_CARD_SEARCH_RATE_LIMITED', retryInMs: 30_000 }, { 'retry-after': '30' }]);
    expect([r.host.listings(), r.audits.length]).toEqual([6, 6]);
    // The refusal counted nothing: one millisecond before the minute it is still refused, at the minute it lists.
    r.advance(29_999);
    expect(await refusal(searchAudioCards(r.seams, CALLER))).toEqual([429, 'RATE_LIMITED', 'AUDIO_CARD_SEARCH_RATE_LIMITED']);
    r.advance(1);
    expect((await searchAudioCards(r.seams, CALLER)).cards).toHaveLength(2);
    expect(r.host.listings()).toBe(7);
    // A registration is the Core's own second listing: not spaced and not counted (row 70, decision DD-3).
    expect((await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 })).created).toBe(true);
    // CONTROL: a gate with a bound of two refuses the third.
    let at = 0;
    const two = createListingGate(() => at, 1_000, 2);
    await two.run('SEARCH', async () => null);
    at += 1_000;
    await two.run('SEARCH', async () => null);
    at += 1_000;
    await expect(two.run('SEARCH', async () => null)).rejects.toMatchObject({ statusCode: 429 });
    // A clock that went back locks nothing out.
    at = -5_000;
    await expect(two.run('SEARCH', async () => 'listed')).resolves.toBe('listed');
  });

  it('the id of a listing: DSC- and thirteen digits of the clock; two listings of one millisecond never share one', () => {
    const next = createAudioCardSearchIds();
    expect([next(START), next(START), next(START + 5), next(START - 60_000)]).toEqual([`DSC-${START}`, `DSC-${START + 1}`, `DSC-${START + 5}`, `DSC-${START + 6}`]);
    expect(next(7)).toMatch(/^DSC-\d{13}$/);
  });
});
