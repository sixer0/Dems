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
import { STORED_CARD_IDENTITY_CASES } from '../../../../../test/support/stored-card-identity-cases';
import { createListingGate, matchStoredCard, registerAudioInput, searchAudioCards, type AudioCardsCaller, type AudioCardsSeams, type MicrophoneRegistrar, type RegisteredMicrophone } from '../service';
import { INSERT_AUDIO_INPUT, READ_AUDIO_INPUT_OF_CARD, READ_BOUND_AUDIO_INPUTS, READ_REGISTERED_AUDIO_INPUTS, REFRESH_AUDIO_INPUT, REKEY_AUDIO_INPUT } from '../statements';
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
  INTERFACE_MOVED_AND_RENAMED,
  INTERFACE_UNREAD_USB_ID,
  OTHER_SERIAL,
  SIX_MOVED_CARD_ID,
  UNREAD_USB_ID,
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
  /** `capture_audio_inputs.retired_at`: set, the row is read by no statement of the module (R-FLEX row 108, D-A3.4). */
  retiredAt?: number;
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
  /** The live rows: every read of the module filters `retired_at IS NULL` (R-FLEX row 108, D-A3.4). */
  const live = (): StoredInput[] => inputs.filter((input) => input.retiredAt === undefined);
  const store: MicrophoneStore = {
    async registeredInputs() {
      trip('registeredInputs');
      return live().map((input) => ({ deviceId: input.deviceId, cardId: input.cardId, cardDevice: input.cardDevice, inputNumber: input.inputNumber, identity: identityOf(input) }));
    },
    async inputOf(_db, key) {
      trip('inputOf');
      const found = live().find((input) => input.cardId === key.cardId && input.cardDevice === key.cardDevice && input.inputNumber === key.inputNumber);
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
    // R-FLEX row 131: DB-A2 and DB-A6 over the same map. Row 108 (D24): every LIVE row of the USB id, also one with neither
    // a serial nor a port, in MIC id order - as the statement.
    async boundInputs(_db, usbId) {
      trip('boundInputs');
      return live()
        .filter((input) => input.usbId === usbId)
        .map((input) => ({ deviceId: input.deviceId, cardDevice: input.cardDevice, inputNumber: input.inputNumber, usbSerial: identityOf(input).usbSerial, usbPort: identityOf(input).usbPort }))
        .sort((left, right) => left.deviceId.localeCompare(right.deviceId));
    },
    async rekeyInput(_db, input) {
      trip('rekeyInput');
      const held = inputs.find((entry) => entry.deviceId === input.deviceId);
      if (held === undefined) throw new Error('row131: no such input');
      Object.assign(held, { usbId: input.usbId, cardId: input.cardId, cardDevice: input.cardDevice, inputNumber: input.inputNumber, operatorId: input.operatorId, at: input.at });
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
        { cardId: DUO.cardId, deviceIndex: 0, usbId: DUO.usbId, usbSerial: null, usbPort: DUO_PORT, product: DUO.product, channelCount: 2, sampleBits: [24], registered: [], boundTo: null },
        { cardId: SIX.cardId, deviceIndex: 0, usbId: SIX.usbId, usbSerial: null, usbPort: SIX_PORT, product: SIX.product, channelCount: 6, sampleBits: [24], registered: [], boundTo: null },
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
    expect(first).toEqual({ created: true, registration: { deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 4, channelCount: 6, releasedDeviceId: null } });
    expect(CaptureAudioInputRegistrationSchema.safeParse(first.registration).success).toBe(true);
    expect(r.devices.get('MIC-03')).toEqual({ model: SIX.product, enabled: true, adapterKind: 'USB_AUDIO', lastSeenAt: START });
    expect(r.inputs).toEqual([{ deviceId: 'MIC-03', usbId: SIX.usbId, cardId: SIX.cardId, cardDevice: 0, inputNumber: 4, nativeChannels: 6, sampleBits: 24, operatorId: CALLER.operatorId, at: START }]);
    expect(r.admitted).toEqual([{ id: 'MIC-03', kind: 'MIC', adapterKind: 'USB_AUDIO', model: SIX.product }]);

    // The microphone went off meanwhile (a stored state of this file).
    r.devices.set('MIC-03', { ...r.devices.get('MIC-03')!, enabled: false });
    r.advance(1_000);
    const second = await registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 4 });
    expect(second).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 4, channelCount: 6, releasedDeviceId: null } });
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
    expect(search.cards.map((card) => [card.registered, card.boundTo])).toEqual([[[{ inputNumber: 4, deviceId: 'MIC-03' }], 'MIC-03']]);
    expect(r.audits.at(-1)?.details).toMatchObject({ responderCount: 1, newCount: 0, registeredCount: 1 });
  });

  // R-FLEX row 131 (D10 (1), Q96-01 a, bundle M Q96-02-M; spec T-9, T-10): THE PHYSICAL CARD IS HELD BY ONE MICROPHONE.
  // Was: "two inputs of one card are two microphones".
  it('a second input of a held card is refused 409 AUDIO_CARD_ALREADY_BOUND naming the holder; with `release: true` the holder MOVES to it: 200 REENABLED, releasedDeviceId = the holder, RELEASED then REENABLED', async () => {
    const r = rig(TWO_CARDS);
    const one = await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 });
    expect(one.registration).toEqual({ deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 1, channelCount: 2, releasedDeviceId: null });
    // T-9: no release - refused with the holder's id; nothing stored, nothing audited.
    const refused = await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 2 }).catch((error: unknown) => error as ApiFailure);
    expect(refused).toBeInstanceOf(ApiFailure);
    expect([(refused as ApiFailure).statusCode, (refused as ApiFailure).code, (refused as ApiFailure).details]).toEqual([409, 'INVALID_STATE', { reason: 'AUDIO_CARD_ALREADY_BOUND', deviceId: 'MIC-03' }]);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 2, release: false }))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_ALREADY_BOUND']);
    expect([usbMicrophones(r.devices), r.inputs.length, r.audits.length]).toEqual([['MIC-03'], 1, 1]);
    // T-10: release - the same microphone, its row moved to input 2; two entries, one binding.
    r.devices.set('MIC-03', { ...r.devices.get('MIC-03')!, enabled: false });
    const moved = await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 2, release: true });
    expect(moved).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 2, channelCount: 2, releasedDeviceId: 'MIC-03' } });
    expect(CaptureAudioInputRegistrationSchema.safeParse(moved.registration).success).toBe(true);
    expect(r.inputs.map((input) => [input.deviceId, input.cardId, input.inputNumber, input.usbId])).toEqual([['MIC-03', DUO.cardId, 2, DUO.usbId]]);
    expect([usbMicrophones(r.devices), r.devices.get('MIC-03')?.enabled, r.reenables]).toEqual([['MIC-03'], true, ['MIC-03']]);
    expect(r.audits.slice(1).map((row) => [row.deviceId, row.details?.['change'], row.details?.['inputNumber']])).toEqual([
      ['MIC-03', 'RELEASED', 1],
      ['MIC-03', 'REENABLED', 2],
    ]);
    // release: true on the holder's OWN input changes nothing: releasedDeviceId is null.
    expect((await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 2, release: true })).registration).toMatchObject({ deviceId: 'MIC-03', change: 'REENABLED', releasedDeviceId: null });
    // Another card is not held: DemsSix input 1 is a new microphone.
    expect((await registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 1 })).registration).toMatchObject({ deviceId: 'MIC-04', change: 'REGISTERED' });
    // The Core listed AGAIN for each registration.
    expect(r.host.listings()).toBe(6);
    // Operation 98: the card is bound to the moved microphone, at its new input.
    const search = await searchAudioCards(r.seams, CALLER);
    expect(search.cards.map((card) => [card.cardId, card.boundTo, card.registered])).toEqual([
      [DUO.cardId, 'MIC-03', [{ inputNumber: 2, deviceId: 'MIC-03' }]],
      [SIX.cardId, 'MIC-04', [{ inputNumber: 1, deviceId: 'MIC-04' }]],
    ]);
    expect(CaptureAudioCardSearchSchema.safeParse(search).success).toBe(true);
  });

  it('a release whose move fails rolls the unit back as a whole: no RELEASED entry, the holder stays where it was', async () => {
    const r = rig(TWO_CARDS);
    await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 });
    r.failNext('rekeyInput');
    await expect(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 2, release: true })).rejects.toMatchObject({ code: 'ROW070_INJECTED' });
    expect([r.inputs.map((input) => input.inputNumber), r.audits.map((row) => row.details?.['change'])]).toEqual([[1], ['REGISTERED']]);
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
    expect(changed).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'CARD_CHANGED', inputNumber: 2, channelCount: 6, releasedDeviceId: null } });
    expect(usbMicrophones(r.devices)).toEqual(['MIC-03']);
    expect(r.inputs.map((input) => input.usbId)).toEqual(['fff0:0099']);
    expect(r.audits.map((row) => row.details?.['change'])).toEqual(['REGISTERED', 'CARD_CHANGED']);
    expect(written(r)).not.toContain('fff0:0099');
  });
});

// Task 4 row 156 (AD-07 (4)), TURNED BY R-FLEX row 131 (spec 01_specs_rflex_audio.md sections 3-6;
// Q96-01 a, Q96-03, Q96-09): the match of a stored input to a live card - the USB id, the serial
// where the card states one, else ANY unit of the model on ANY port. The port is no lock. The
// double: the real enumerator over fixed host texts that differ in the port path or the card id.
describe('row 156 / R-FLEX row 131: the identity of the card behind a stored input (USB id, serial, else the model)', () => {
  const KEY = { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 2 } as const;
  const changes = (r: Rig) => r.audits.filter((row) => row.type === 'CAPTURE_AUDIO_INPUT_CHANGED').map((row) => row.details?.['change']);
  const matchNotes = (r: Rig) => (r.notes as Array<Record<string, unknown>>).filter((note) => note['code'] === 'CAPTURE_AUDIO_INPUT_CHANGED').map((note) => note['match'] ?? null);

  it('A PORT MOVE IS NOT A RE-BIND (AC9, D-A4.1): the serial-less card on ANOTHER PORT under its key is the same card - REENABLED, the microphone on again, the stored port follows, no device text written', async () => {
    const r = rig(ONE_INTERFACE);
    await registerAudioInput(r.seams, CALLER, KEY);
    r.devices.set('MIC-03', { ...r.devices.get('MIC-03')!, enabled: false });
    r.host.use(INTERFACE_ON_ANOTHER_PORT);
    const moved = await registerAudioInput(r.seams, CALLER, KEY);
    expect(moved).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 2, channelCount: 6, releasedDeviceId: null } });
    expect([changes(r), matchNotes(r), r.reenables, r.devices.get('MIC-03')?.enabled, r.identities.get('MIC-03')]).toEqual([['REGISTERED', 'REENABLED'], [null, 'SAME_CARD'], ['MIC-03'], true, { usbSerial: null, usbPort: OTHER_PORT }]);
    expect([usbMicrophones(r.devices), r.inputs.length]).toEqual([['MIC-03'], 1]);
    expect(Object.keys(r.audits.at(-1)?.details ?? {}).sort()).toEqual(['change', 'channelCount', 'deviceId', 'inputNumber', 'operationId', 'permission']);
    for (const text of [SIX_PORT, OTHER_PORT, ...DEVICE_TEXT]) expect(written(r)).not.toContain(text);
  });

  it('T-6 / T-7 / T-8 (macOS move, D-A4.2): the card under ANOTHER kernel card id and port is still bound by identity; operation 99 at the same input RE-KEYS the holder - 200 REENABLED, no release, no new microphone', async () => {
    const r = rig(ONE_INTERFACE);
    await registerAudioInput(r.seams, CALLER, { ...KEY, inputNumber: 1 });
    r.host.use(INTERFACE_MOVED_AND_RENAMED);
    const search = await searchAudioCards(r.seams, CALLER);
    expect(search.cards.map((card) => [card.cardId, card.boundTo, card.registered])).toEqual([[SIX_MOVED_CARD_ID, 'MIC-03', [{ inputNumber: 1, deviceId: 'MIC-03' }]]]);
    expect(CaptureAudioCardSearchSchema.safeParse(search).success).toBe(true);
    const moved = await registerAudioInput(r.seams, CALLER, { cardId: SIX_MOVED_CARD_ID, deviceIndex: 0, inputNumber: 1 });
    expect(moved).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 1, channelCount: 6, releasedDeviceId: null } });
    expect(r.inputs.map((input) => [input.deviceId, input.cardId, input.inputNumber])).toEqual([['MIC-03', SIX_MOVED_CARD_ID, 1]]);
    expect([r.identities.get('MIC-03'), changes(r), usbMicrophones(r.devices)]).toEqual([{ usbSerial: null, usbPort: OTHER_PORT }, ['REGISTERED', 'REENABLED'], ['MIC-03']]);
    // Another input of the moved card is a new binding of a held card: refused, naming the holder.
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: SIX_MOVED_CARD_ID, deviceIndex: 0, inputNumber: 3 }))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_ALREADY_BOUND']);
  });

  it('R-3: a move onto a key ANOTHER row already holds rolls back 409 AUDIO_INPUT_NOT_REGISTRABLE - nothing written, nothing said', async () => {
    const r = rig(ONE_INTERFACE);
    await registerAudioInput(r.seams, CALLER, { ...KEY, inputNumber: 1 });
    // A stale row of another card sits under the new key (written before the card moved there).
    r.inputs.push({ deviceId: 'MIC-01', usbId: 'fff0:0099', cardId: SIX_MOVED_CARD_ID, cardDevice: 0, inputNumber: 1, nativeChannels: 2, sampleBits: 24, operatorId: CALLER.operatorId, at: START });
    r.identities.set('MIC-01', { usbSerial: null, usbPort: 'p-x' });
    r.host.use(INTERFACE_MOVED_AND_RENAMED);
    const audits = r.audits.length;
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: SIX_MOVED_CARD_ID, deviceIndex: 0, inputNumber: 1 }))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_NOT_REGISTRABLE']);
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: SIX_MOVED_CARD_ID, deviceIndex: 0, inputNumber: 1, release: true }))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_NOT_REGISTRABLE']);
    expect([r.audits.length - audits, r.inputs.find((input) => input.deviceId === 'MIC-03')?.cardId]).toEqual([0, SIX.cardId]);
  });

  it('AU-R3 / Q96-03 (i)+(iii): TWO SERIAL-LESS UNITS OF ONE MODEL cannot be told apart - NOT_TELLABLE: the stored input is CARD_CHANGED, both units are shown bound to the microphone, the second is refused AUDIO_CARD_ALREADY_BOUND', async () => {
    const r = rig(ONE_INTERFACE);
    await registerAudioInput(r.seams, CALLER, KEY);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
    r.host.use(TWO_OF_ONE_PRODUCT);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('CARD_CHANGED');
    r.host.use(TWO_OF_ONE_PRODUCT_SWAPPED);
    expect((await registerAudioInput(r.seams, CALLER, KEY)).registration.change).toBe('CARD_CHANGED');
    expect(matchNotes(r)).toEqual([null, 'SAME_CARD', 'NOT_TELLABLE', 'NOT_TELLABLE']);
    // The second unit, under its own key: held by MIC-03 (conservative), never a second microphone.
    expect(await refusal(registerAudioInput(r.seams, CALLER, { ...KEY, cardId: SIX_SECOND_CARD_ID }))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_ALREADY_BOUND']);
    expect(usbMicrophones(r.devices)).toEqual(['MIC-03']);
    r.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
    const search = await searchAudioCards(r.seams, CALLER);
    // Bound, both; registered (SAME_CARD) on neither: the rule cannot say which unit it is.
    expect(search.cards.map((card) => [card.cardId, card.boundTo, card.registered])).toEqual([
      [SIX.cardId, 'MIC-03', []],
      [SIX_SECOND_CARD_ID, 'MIC-03', []],
    ]);
  });

  // TURNED BY R-FLEX row 131 (Q96-09, register RM-A4 removed): a row with neither a serial nor a port
  // path is read as "no serial" - any serial-less unit of its model. Was: a refusal of its own (register RM-A4).
  it('where NO identity is stored (a row of before the two columns): read as "no serial" - the one serial-less unit of the model, on any port, is the same card and REENABLED; a twin beside it is NOT_TELLABLE', async () => {
    const before = rig(ONE_INTERFACE, { storesIdentity: false });
    await registerAudioInput(before.seams, CALLER, KEY);
    before.devices.set('MIC-03', { ...before.devices.get('MIC-03')!, enabled: false });
    expect((await registerAudioInput(before.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
    before.host.use(INTERFACE_ON_ANOTHER_PORT);
    expect((await registerAudioInput(before.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
    before.host.use(TWO_OF_ONE_PRODUCT);
    expect((await registerAudioInput(before.seams, CALLER, KEY)).registration.change).toBe('CARD_CHANGED');
    expect(matchNotes(before)).toEqual([null, 'SAME_CARD', 'SAME_CARD', 'NOT_TELLABLE']);
    expect([before.reenables, before.devices.get('MIC-03')?.enabled, usbMicrophones(before.devices)]).toEqual([['MIC-03', 'MIC-03'], true, ['MIC-03']]);
    // TURNED BY R-FLEX row 108 (D24, DB-A2 filter dropped): such a row IS a holder for operation 98. The two serial-less
    // units cannot be told apart, so both are bound to it and neither is `registered` (was: [[null, []], [null, []]]).
    before.advance(CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS);
    expect((await searchAudioCards(before.seams, CALLER)).cards.map((card) => [card.boundTo, card.registered])).toEqual([['MIC-03', []], ['MIC-03', []]]);
  });

  it('T-16 (RM-A5): a USB card whose USB id could not be read is refused 409 AUDIO_INPUT_NOT_REGISTRABLE; a serial-less card with a USB id and NO port is registered (201)', async () => {
    const unread = rig(INTERFACE_UNREAD_USB_ID);
    expect((await unread.host.enumerator.list()).cards.map((card) => card.usbId)).toEqual([UNREAD_USB_ID]);
    expect(await refusal(registerAudioInput(unread.seams, CALLER, KEY))).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_NOT_REGISTRABLE']);
    expect([unread.inputs, unread.audits, usbMicrophones(unread.devices)]).toEqual([[], [], []]);
    const portless = rig(INTERFACE_WITHOUT_PORT);
    const created = await registerAudioInput(portless.seams, CALLER, KEY);
    expect(created).toEqual({ created: true, registration: { deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 2, channelCount: 6, releasedDeviceId: null } });
    expect(portless.identities.get('MIC-03')).toEqual({ usbSerial: null, usbPort: null });
    // Registered with a port, then listed without one: the same card (the model), REENABLED.
    const offered = rig(ONE_INTERFACE);
    await registerAudioInput(offered.seams, CALLER, KEY);
    offered.host.use(INTERFACE_WITHOUT_PORT);
    expect((await registerAudioInput(offered.seams, CALLER, KEY)).registration.change).toBe('REENABLED');
  });

  // THE GAP FILED BY ROW 131 IS CLOSED (R-FLEX row 108, decision D24): DB-A2 `READ_BOUND_AUDIO_INPUTS` no longer keeps the
  // bundle-C filter "a serial or a port". A serial-less, port-less row (T-16 makes them; Q96-09 a) holds its card: operation
  // 98 names it in `boundTo`, and operation 99 refuses another input of the card. Was `it.fails`.
  it('DB-A2 (row 108): a card stored with neither serial nor port IS held - operation 98 names its holder, another input is refused AUDIO_CARD_ALREADY_BOUND; with `release` the holder moves', async () => {
    const portless = rig(INTERFACE_WITHOUT_PORT);
    await registerAudioInput(portless.seams, CALLER, KEY);
    expect(portless.identities.get('MIC-03')).toEqual({ usbSerial: null, usbPort: null });
    const search = await searchAudioCards(portless.seams, CALLER);
    expect(search.cards.map((card) => [card.cardId, card.boundTo, card.registered])).toEqual([[SIX.cardId, 'MIC-03', [{ inputNumber: 2, deviceId: 'MIC-03' }]]]);
    expect(await refusal(registerAudioInput(portless.seams, CALLER, { ...KEY, inputNumber: 5 }))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_ALREADY_BOUND']);
    expect([usbMicrophones(portless.devices), portless.inputs.length]).toEqual([['MIC-03'], 1]);
    expect((await registerAudioInput(portless.seams, CALLER, { ...KEY, inputNumber: 5, release: true })).registration).toEqual({ deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 5, channelCount: 6, releasedDeviceId: 'MIC-03' });
    expect(portless.inputs.map((input) => [input.deviceId, input.inputNumber])).toEqual([['MIC-03', 5]]);
  });

  // R-FLEX row 108 (spec 5.1, D-A3.4): A RETIRED ROW HOLDS NOTHING. It neither blocks another input of its card nor occupies its key.
  it('a RETIRED holder does not block: its key and its card are free again - a new microphone, 201 REGISTERED; operation 98 names the new holder only', async () => {
    const r = rig(TWO_CARDS);
    await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 });
    const retired = r.inputs.find((input) => input.deviceId === 'MIC-03')!;
    retired.retiredAt = START;
    // The KEY of the retired row: a new microphone, never a re-enable of the retired one.
    const again = await registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 });
    expect(again).toEqual({ created: true, registration: { deviceId: 'MIC-04', change: 'REGISTERED', inputNumber: 1, channelCount: 2, releasedDeviceId: null } });
    expect(r.reenables).toEqual([]);
    // The new microphone holds the card; the retired one is no holder for operation 98 or 99.
    expect(await refusal(registerAudioInput(r.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 2 }))).toEqual([409, 'INVALID_STATE', 'AUDIO_CARD_ALREADY_BOUND']);
    const search = await searchAudioCards(r.seams, CALLER);
    expect(search.cards.map((card) => [card.cardId, card.boundTo, card.registered])).toEqual([
      [DUO.cardId, 'MIC-04', [{ inputNumber: 1, deviceId: 'MIC-04' }]],
      [SIX.cardId, null, []],
    ]);
    // Another input of a card whose ONLY holder is retired: not refused.
    const other = rig(TWO_CARDS);
    await registerAudioInput(other.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 1 });
    other.inputs[0]!.retiredAt = START;
    expect((await registerAudioInput(other.seams, CALLER, { cardId: DUO.cardId, deviceIndex: 0, inputNumber: 2 })).registration).toEqual({ deviceId: 'MIC-04', change: 'REGISTERED', inputNumber: 2, channelCount: 2, releasedDeviceId: null });
  });

  // R-FLEX row 108 (spec X-2): SEVERAL microphones already hold one card (an older database; 01_specs_rflex_database.md 5,
  // last row). Nothing is moved, also with `release`: refused naming the FIRST holder, the lowest MIC id, which is also
  // operation 98's `boundTo`. Nothing is written and nothing is said.
  it('X-2: a card held by SEVERAL live rows - op 99 refuses AUDIO_CARD_ALREADY_BOUND naming the first holder (lowest MIC id), with and without release; op 98 boundTo names the same', async () => {
    const r = rig(TWO_CARDS);
    for (const [deviceId, inputNumber] of [['MIC-02', 2], ['MIC-01', 1]] as const) {
      r.inputs.push({ deviceId, usbId: SIX.usbId, cardId: SIX.cardId, cardDevice: 0, inputNumber, nativeChannels: 6, sampleBits: 24, operatorId: CALLER.operatorId, at: START });
      r.identities.set(deviceId, { usbSerial: null, usbPort: SIX_PORT });
    }
    const failure = async (pending: Promise<unknown>): Promise<unknown> => pending.then(() => 'answered', (error: unknown) => [(error as ApiFailure).statusCode, (error as ApiFailure).details]);
    const before = structuredClone(r.inputs);
    for (const release of [false, true]) {
      expect(await failure(registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 4, release })), String(release)).toEqual([409, { reason: 'AUDIO_CARD_ALREADY_BOUND', deviceId: 'MIC-01' }]);
    }
    // The key of one holder, released towards it: still several holders - refused, nothing moved.
    expect(await failure(registerAudioInput(r.seams, CALLER, { cardId: SIX.cardId, deviceIndex: 0, inputNumber: 2, release: true }))).toEqual([409, { reason: 'AUDIO_CARD_ALREADY_BOUND', deviceId: 'MIC-01' }]);
    expect([r.inputs, r.audits, r.reenables, usbMicrophones(r.devices)]).toEqual([before, [], [], []]);
    const search = await searchAudioCards(r.seams, CALLER);
    expect(search.cards.map((card) => [card.cardId, card.boundTo, card.registered])).toEqual([
      [DUO.cardId, null, []],
      [SIX.cardId, 'MIC-01', [{ inputNumber: 1, deviceId: 'MIC-01' }, { inputNumber: 2, deviceId: 'MIC-02' }]],
    ]);
  });

  // T-1 (spec 10): THE SHARED CASE TABLE of row 107 pins `matchStoredCard` to the outcome of every case.
  it('T-1: the shared case table - matchStoredCard answers the registration outcome of every case; no case and no answer is a port refusal (register RM-A2)', () => {
    let measured = 0;
    for (const entry of STORED_CARD_IDENTITY_CASES) {
      if (entry.registration === null) continue;
      const listing = entry.live.map((unit) => ({ cardId: unit.cardId, deviceIndex: 0, usbId: unit.usbId, usbSerial: unit.usbSerial, usbPort: unit.usbPort, product: 'P', channelCount: 2, factsSource: 'STREAM', sampleBits: [24 as const] }));
      const candidate = listing[entry.registration.unit];
      if (candidate === undefined) throw new Error(`case ${entry.name}: no unit ${entry.registration.unit}`);
      expect(matchStoredCard(entry.stored, candidate, listing), entry.name).toBe(entry.registration.match);
      measured += 1;
    }
    expect(measured).toBe(STORED_CARD_IDENTITY_CASES.filter((entry) => entry.registration !== null).length);
    expect(JSON.stringify(STORED_CARD_IDENTITY_CASES)).not.toMatch(/PORT_DIFF/);
    console.info(`[row131] T-1 shared case table | cases=${STORED_CARD_IDENTITY_CASES.length} registration cases=${measured}`);
  });

  // TURNED BY R-FLEX row 131: the table of rows 156 / 199 under the rule without a port lock. The rows that changed are marked.
  it('the rule itself, as a table: the USB id first, then the SERIAL (the port a tie-break only), else the model on any port; never the product or the card id', () => {
    type Live = Parameters<typeof matchStoredCard>[1];
    const live = (over: Partial<Live> = {}): Live => ({ cardId: 'Card', deviceIndex: 0, usbId: 'fff0:0006', usbPort: 'p-1', product: 'P', channelCount: 2, factsSource: 'STREAM', sampleBits: [24], ...over });
    const card = live();
    const twin = live({ cardId: 'Card_1', usbPort: 'p-2' });
    const serialled = live({ usbSerial: 'SN-A' });
    const table: Array<[string, Parameters<typeof matchStoredCard>[0], Live, Parameters<typeof matchStoredCard>[2], string]> = [
      ['same id, same port', { usbId: 'fff0:0006', usbPort: 'p-1' }, card, [card], 'SAME_CARD'],
      ['another id, same port', { usbId: 'fff0:0099', usbPort: 'p-1' }, card, [card], 'USB_ID_DIFFERS'],
      ['a stored id, a live card without one', { usbId: 'fff0:0006', usbPort: 'p-1' }, live({ usbId: null, usbPort: null }), [card], 'USB_ID_DIFFERS'],
      ['two capture devices of ONE card are not two cards', { usbId: 'fff0:0006', usbPort: 'p-1' }, card, [card, live({ deviceIndex: 1 })], 'SAME_CARD'],
      ['not a USB card on either side: the key is all it has', { usbId: null }, live({ usbId: null, usbPort: null }), [live({ usbId: null, usbPort: null }), live({ cardId: 'Other', usbId: null, usbPort: null })], 'SAME_CARD'],
      // ── TURNED by row 131: no port lock (was the port refusal, RM-A2) ──
      ['same id, another port', { usbId: 'fff0:0006', usbPort: 'p-9' }, card, [card], 'SAME_CARD'],
      ['a stored port, no live port, one card of the id', { usbId: 'fff0:0006', usbPort: 'p-1' }, live({ usbPort: null }), [live({ usbPort: null })], 'SAME_CARD'],
      // ── TURNED by row 131: two serial-less units of the model are not tellable (was SAME_CARD by the port, or the port refusal) ──
      ['same id, same port, a serial-less twin beside it', { usbId: 'fff0:0006', usbPort: 'p-1' }, card, [card, twin], 'NOT_TELLABLE'],
      ['a stored port, no live port, two cards of the id', { usbId: 'fff0:0006', usbPort: 'p-1' }, live({ usbPort: null }), [card, twin], 'NOT_TELLABLE'],
      // ── TURNED by row 131: no stored identity is read as "no serial" (was the refusal of RM-A4) ──
      ['no stored port, one card of the id', { usbId: 'fff0:0006' }, card, [card], 'SAME_CARD'],
      ['a null stored port, one card of the id', { usbId: 'fff0:0006', usbPort: null }, card, [card], 'SAME_CARD'],
      ['an empty stored port is no port', { usbId: 'fff0:0006', usbPort: '' }, card, [card, twin], 'NOT_TELLABLE'],
      ['no stored port, two cards of the id', { usbId: 'fff0:0006' }, card, [card, twin], 'NOT_TELLABLE'],
      ['no stored identity, a live card with a serial', { usbId: 'fff0:0006', usbSerial: null, usbPort: null }, serialled, [serialled], 'SERIAL_DIFFERS'],
      ['no serial stored, a serial-less unit beside one that states a serial', { usbId: 'fff0:0006', usbPort: 'p-1' }, twin, [serialled, twin], 'SAME_CARD'],
      // ── the serial (unchanged since row 199) ──
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
      ['a shared serial, the stored port', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-1' }, serialled, [serialled, live({ cardId: 'Card_1', usbSerial: 'SN-A', usbPort: 'p-2' })], 'SAME_CARD'],
      ['a shared serial, another port', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-2' }, serialled, [serialled, live({ cardId: 'Card_1', usbSerial: 'SN-A', usbPort: 'p-2' })], 'NOT_TELLABLE'],
      ['a shared serial, no stored port', { usbId: 'fff0:0006', usbSerial: 'SN-A' }, serialled, [serialled, live({ cardId: 'Card_1', usbSerial: 'SN-A', usbPort: 'p-2' })], 'NOT_TELLABLE'],
      ['a shared serial on two capture devices of ONE card is one card', { usbId: 'fff0:0006', usbSerial: 'SN-A', usbPort: 'p-9' }, serialled, [serialled, live({ deviceIndex: 1, usbSerial: 'SN-A' })], 'SAME_CARD'],
    ];
    for (const [name, stored, liveCard, listing, expected] of table) expect(matchStoredCard(stored, liveCard, listing), name).toBe(expected);
    // The product is no part of the rule: another product text on the same id and port is the same card.
    expect(matchStoredCard({ usbId: 'fff0:0006', usbPort: 'p-1' }, live({ product: 'Another name' }), [card])).toBe('SAME_CARD');
    expect(table.filter((row) => /PORT_DIFF|NOT_STORED/.test(row[4]))).toEqual([]);
    console.info(`[row131] the identity rule | rows of the table=${table.length} answers=${[...new Set(table.map((row) => row[4]))].sort().join(',')}`);
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

  // R-FLEX row 131: the case "no serial on either side, another port" left this table (no port lock: a port move is REENABLED, block above).
  it('A SAME-PRODUCT CARD WITH NO MATCHING SERIAL ON ANOTHER PORT is CARD_CHANGED with 1 audit entry and 0 re-enabled rows; operation 98 offers it as a NEW card; registered by the technician, the same call again is REENABLED', async () => {
    for (const [name, registeredOn, swapped, match] of [
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
      expect(offered.cards.map((card) => [card.cardId, card.registered, card.boundTo]), name).toEqual([[SIX.cardId, [], null]]);
      expect(r.audits.at(-1)?.details, name).toMatchObject({ responderCount: 1, newCount: 1, registeredCount: 0 });
      // Operation 99 against it: said, ONE entry, the microphone NOT enabled again, no second device.
      const audits = r.audits.length;
      const changed = await registerAudioInput(r.seams, CALLER, KEY);
      expect(changed, name).toEqual({ created: false, registration: { deviceId: 'MIC-03', change: 'CARD_CHANGED', inputNumber: 2, channelCount: 6, releasedDeviceId: null } });
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
    expect((await searchAudioCards(r.seams, CALLER)).cards.map((card) => [card.cardId, card.registered.length, card.boundTo])).toEqual([[SIX.cardId, 1, 'MIC-03'], [SIX_SECOND_CARD_ID, 0, null]]);
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
    // R-FLEX row 131: the two statements of row 130 the service now calls.
    await real.rekeyInput(connection, { deviceId: 'MIC-03', usbId: 'fff0:0006', usbSerial: 'bad serial', usbPort: 'p-3', cardId: 'usb_1420', cardDevice: 0, inputNumber: 1, operatorId: 'OP-0003', at: 1 });
    expect(calls).toEqual([
      [INSERT_AUDIO_INPUT, ['MIC-03', 'fff0:0006', 'SN-A', 'p-1', 'DemsSix', 0, 2, 6, 24, 'OP-0003', 1]],
      [REFRESH_AUDIO_INPUT, ['MIC-03', 'fff0:0006', null, 'p-2', 6, 24, 'OP-0003', 1]],
      [REKEY_AUDIO_INPUT, ['MIC-03', 'fff0:0006', null, 'p-3', 'usb_1420', 0, 1, 'OP-0003', 1]],
    ]);
    expect(await real.boundInputs(connection, 'fff0:0006')).toEqual([{ deviceId: 'MIC-03', cardDevice: 0, inputNumber: 2, usbSerial: 'SN-A', usbPort: null }]);
    expect(calls.at(-1)).toEqual([READ_BOUND_AUDIO_INPUTS, ['fff0:0006']]);
    expect([INSERT_AUDIO_INPUT.match(/\$\d+/g)?.length, REFRESH_AUDIO_INPUT.match(/\$\d+/g)?.length]).toEqual([11, 8]);
    for (const statement of [INSERT_AUDIO_INPUT, REFRESH_AUDIO_INPUT, READ_AUDIO_INPUT_OF_CARD, READ_REGISTERED_AUDIO_INPUTS]) expect(statement).toMatch(/usb_id.*usb_serial.*usb_port/);
    // R-FLEX row 108 (D-A3.4, D24): every read of operations 98 and 99 skips retired rows; DB-A2 keeps no serial-or-port filter.
    for (const statement of [READ_AUDIO_INPUT_OF_CARD, READ_REGISTERED_AUDIO_INPUTS, READ_BOUND_AUDIO_INPUTS]) expect(statement).toMatch(/WHERE .*i\.retired_at IS NULL/);
    expect(READ_BOUND_AUDIO_INPUTS).not.toMatch(/IS NOT NULL/);
    expect(READ_BOUND_AUDIO_INPUTS).toMatch(/ORDER BY i\.device_id$/);
    // REKEY writes only granted columns (migrations 0016, 0018): never device_id, sample_rate or retired_at.
    expect(REKEY_AUDIO_INPUT.slice(REKEY_AUDIO_INPUT.indexOf(' SET '), REKEY_AUDIO_INPUT.indexOf(' WHERE '))).not.toMatch(/device_id|sample_rate|retired_at/);
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
