// The connect flow on doubles: no database, no socket (blueprint row 142; checks M4-CONN-NOCRED-1,
// M4-CONN-SSRF-1, M4-CONN-ORDER-1 (unit half), M4-SEC-AUD-1, M4-SEC-RATE-1 through the service,
// M4-SEC-CONN-3 (the deadline on a manual clock); contract C3 §2.6; D76, D86 C-3; SEC35-34).
//
// The tester is a SPY: it records every call and what it was handed, and answers what the test
// says. A PRODUCTION candidate has a documentation address (RFC 5737) that nothing ever contacts.
// The routes and the transaction are proven in `connect.db.test.ts`. EVERY RULE HAS ITS CONTROL.
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { CAPTURE_CONNECTION_TEST_TIMEOUT_MS, CAPTURE_CONNECTION_TEST_VALIDITY_MS, CaptureConnectionOutcome } from '@dems/shared/api';
import type { AuditRow } from '@dems/shared/sim';
import { afterAll, describe, expect, it } from 'vitest';
import { codeOnly } from '../../../../../test/static/scan';
import { CaptureAdapterError, CaptureAdapterKind, CaptureAdapterRefusal, sealCredential, usingCredential, type CameraCandidate, type JudgedStream, type SealedCredential } from '../../../../capture/adapters';
import type { AuditEntry, UnitContext } from '../../../../core';
import type { EngineUnit } from '../../../../engine';
import type { Principal } from '../../../../plugins/authenticate';
import { ApiFailure } from '../../../../plugins/error-envelope';
import { createConnectionTestLimits } from '../limits';
import {
  CLEAR_SECRET_PROOF_BYTES,
  auditEndpointRef,
  holdsClearSecret,
  adoptCandidate,
  nextCameraId,
  operatorCredential,
  setCredential,
  testCandidate,
  type AdoptedDevice,
  type CandidateTestRecord,
  type ConnectCaller,
  type ConnectCandidate,
  type ConnectSeams,
  type ConnectionAttempt,
  CANDIDATE_TEST_ADDRESS_REFUSED,
  type CandidateSourceBinding,
  type ConnectionTester,
} from '../service';
import type { DestinationContext } from '../../../../capture/destination-rule';
import { storedCameraAddressRuleOf } from '../../../../capture/fence';
import { AdoptionProfileInvalid, INSERT_ADOPTED_CAMERA_STREAM, assertAdoptedProfiles, writeAdoptedCameraStreams } from '../../adoption';
import { READ_REGISTERED_CAMERAS } from '../../registered';
import { createCredentialStore, isStoreSealedSecret } from '../../../../credential-store';

// The sealer of every world is the Core credential store's own (fix F-M4, question 2): the connect flow
// takes no other answer. Its key files live in a directory of this file, removed at the end.
const STORE_ROOT = mkdtempSync(join(tmpdir(), 'dems-fm4-connect-'));
afterAll(() => rmSync(STORE_ROOT, { recursive: true, force: true }));
const STORE = createCredentialStore({ root: join(STORE_ROOT, 'credential-store') });

const ACCOUNT = { username: `cnryU${'a1b2c3'.repeat(4)}`, secret: `cnryS${'d4e5f6'.repeat(4)}` };
const PRODUCTION_HOST = '192.0.2.40';
const ENDPOINT = 'urn:uuid:11111111-2222-3333-4444-555555555555';
const operator = (sessionId: string, operatorId = 'OPR-002'): ConnectCaller => ({ principal: { kind: 'OPERATOR', operatorId, sessionId, deviceId: null, role: 'SUPERVISOR' } as Extract<Principal, { kind: 'OPERATOR' }> });
const CALLER = operator('SESSION-A');

const camera = (overrides: Partial<CameraCandidate> = {}): CameraCandidate => ({
  adapterKind: CaptureAdapterKind.ONVIF_RTSP,
  host: PRODUCTION_HOST,
  serviceAddress: `http://${PRODUCTION_HOST}/onvif/device_service`,
  endpointRef: ENDPOINT,
  vendor: null,
  model: 'Model X',
  name: 'Camera',
  testable: true,
  conflict: false,
  ...overrides,
});
const development = (overrides: Partial<CameraCandidate> = {}): CameraCandidate => camera({ adapterKind: CaptureAdapterKind.FAKE, host: '127.0.0.1', serviceAddress: 'http://127.0.0.1:8564/onvif/device_service', ...overrides });

interface World {
  readonly seams: ConnectSeams;
  /** Every call of the tester: the host it was aimed at, and whether a credential came with it. */
  readonly contacted: { host: string; credential: SealedCredential | null; signal: AbortSignal }[];
  readonly audit: AuditEntry[];
  readonly notes: Record<string, unknown>[];
  readonly timers: { delayMs: number; fire(): void; cancelled: boolean }[];
  readonly candidates: Map<string, { owner: string; candidate: { -readonly [Key in keyof ConnectCandidate]: ConnectCandidate[Key] } }>;
  answer: ConnectionAttempt | Error | 'HANG';
  sessionOpen: boolean;
  /** The camera ids the registry TABLE holds beyond the listed state (finding R69-03: a stored development device a production Core does not list). */
  storedOnly: string[];
  /** What a sealer that is NOT the store answers, when a test hands one in; null: the store's own answer. */
  standInSealer: ((deviceId: string, secret: string) => Promise<{ keyRef: string; ciphertext: Uint8Array; nonce: Uint8Array }>) | null;
  now: number;
  provided: { candidates: boolean; tester: boolean; sealer: boolean; registrar: boolean };
  add(candidateId: string, device: CameraCandidate, owner?: string): void;
}

function world(): World {
  const state: World = {
    contacted: [],
    audit: [],
    notes: [],
    timers: [],
    candidates: new Map(),
    answer: { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, usableProfiles: ['main'], rejectedCredentialRequests: 0 },
    sessionOpen: false,
    storedOnly: [],
    standInSealer: null,
    now: 1_800_000_000_000,
    provided: { candidates: true, tester: true, sealer: true, registrar: true },
    add(candidateId, device, owner = 'SESSION-A') {
      state.candidates.set(candidateId, { owner, candidate: { candidateId, searchId: 'DSC-000001', camera: device, registeredDeviceId: null, lastTest: null } });
    },
    seams: undefined as unknown as ConnectSeams,
  };
  const unit = { audit: { append: async (entry: AuditEntry) => (state.audit.push(entry), {} as AuditRow) }, query: async (text: string) => (text === READ_REGISTERED_CAMERAS ? { rows: state.storedOnly.map((id) => ({ id, address: null, onvif_uuid: null })), rowCount: state.storedOnly.length } : { rows: [], rowCount: 0 }) } as unknown as UnitContext;
  const slices = () => ({
    session: state.sessionOpen ? ({ state: 'RECORDING' } as never) : null,
    captureDevices: { devices: [{ id: 'CAM-01', kind: 'CAMERA', host: '192.0.2.1' }, { id: 'CAM-02', kind: 'CAMERA', host: '192.0.2.2' }, { id: 'MIC-01', kind: 'MIC', host: null }] },
    captureConfig: { cameras: [], mics: [], locked: false, updatedAt: 1 },
  });
  (state as { seams: ConnectSeams }).seams = {
    limits: createConnectionTestLimits({ now: () => state.now }),
    candidates: () =>
      state.provided.candidates
        ? {
            find: (sessionId, candidateId) => {
              const entry = state.candidates.get(candidateId);
              return entry !== undefined && entry.owner === sessionId ? { ...entry.candidate } : null;
            },
            recordTest: (_sessionId, candidateId, test: CandidateTestRecord) => {
              const entry = state.candidates.get(candidateId);
              if (entry !== undefined) entry.candidate.lastTest = test;
            },
            markRegistered: (_sessionId, candidateId, deviceId) => {
              const entry = state.candidates.get(candidateId);
              if (entry !== undefined) entry.candidate.registeredDeviceId = deviceId;
            },
          }
        : null,
    tester: () =>
      state.provided.tester
        ? {
            test: (device, credential, signal) => {
              state.contacted.push({ host: device.host, credential, signal });
              if (state.answer === 'HANG') return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ outcome: CaptureConnectionOutcome.UNREACHABLE, authenticated: credential !== null, usableProfiles: [] })));
              return state.answer instanceof Error ? Promise.reject(state.answer) : Promise.resolve(state.answer);
            },
          }
        : null,
    sealer: () => (state.provided.sealer ? { seal: (deviceId, secret) => (state.standInSealer ?? STORE.capture.seal)(deviceId, secret) } : null),
    storeSealed: isStoreSealedSecret,
    registrar: () => (state.provided.registrar ? async (_scope, _principal, device) => ({ id: device.id, kind: 'CAMERA', model: device.model, firmware: null, host: device.address, poePort: null, online: true, streamState: null, capabilities: ['VIDEO'] }) : null),
    host: {
      now: () => state.now,
      state: () => slices() as never,
      engineUnit: async (_label, work) => ({ value: await work({ unit, pending: () => slices(), command: async () => undefined } as unknown as EngineUnit), epoch: 1, revision: 1 }),
      nativeUnit: (_label, work) => work(unit),
      after: (delayMs, callback) => {
        const timer = { delayMs, fire: callback, cancelled: false };
        state.timers.push(timer);
        return () => {
          timer.cancelled = true;
        };
      },
      note: (fields) => void state.notes.push({ ...fields }),
    },
  };
  return state;
}

const typed = () => operatorCredential(sealCredential(ACCOUNT));
const refusal = async (pending: Promise<unknown>): Promise<[number, string, unknown]> => {
  const error: unknown = await pending.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiFailure)) throw new Error(`expected a refusal, got ${error === null ? 'an answer' : String(error)}`);
  return [error.statusCode, error.code, error.details?.['reason']];
};
/** Past the spacing of the limits. */
const later = (w: World): void => {
  w.now += 11_000;
};

describe('M4-CONN-NOCRED-1: no connection test without an operator-entered credential - by construction', () => {
  it('a PRODUCTION candidate without the credential member: 422 CREDENTIAL_REQUIRED, the tester is never called, no row', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    expect(await refusal(testCandidate(w.seams, CALLER, 'CND-000000000001', null))).toEqual([422, 'INVALID_INPUT', 'CREDENTIAL_REQUIRED']);
    expect(w.contacted).toEqual([]);
    expect(w.audit).toEqual([]);
    expect(w.seams.limits.busy()).toBe(false);
  });

  it('with the body\'s credential: ONE call, to the candidate\'s own host, with exactly that credential; a DEVELOPMENT candidate may be tested without one', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    const credential = typed();
    expect(await testCandidate(w.seams, CALLER, 'CND-000000000001', credential)).toMatchObject({ outcome: 'REACHABLE', authenticated: true, usableProfileCount: 1 });
    expect(w.contacted).toHaveLength(1);
    expect(w.contacted[0]?.host).toBe(PRODUCTION_HOST);
    expect(w.contacted[0]?.credential).toBe(credential.sealed);
    expect(usingCredential(w.contacted[0]!.credential!, (value) => ({ ...value }))).toEqual(ACCOUNT);
    later(w);
    w.add('CND-000000000002', development());
    expect(await testCandidate(w.seams, CALLER, 'CND-000000000002', null)).toMatchObject({ outcome: 'REACHABLE', authenticated: false });
    expect(w.contacted[1]).toMatchObject({ host: '127.0.0.1', credential: null });
  });

  it('an AUTHENTICATION_FAILED outcome is followed by 0 further calls: nothing retries', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    w.answer = { outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 1 };
    expect(await testCandidate(w.seams, CALLER, 'CND-000000000001', typed())).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', failedAttemptsRemaining: 1 });
    expect(w.contacted).toHaveLength(1);
  });

  it('the static half: a device is contacted in ONE place, a permit is made in ONE place, and the folder reads no stored credential', () => {
    const folder = join(import.meta.dirname, '..');
    const sources = codeOnly(readdirSync(folder).filter((name) => name.endsWith('.ts')).map((name) => ({ path: name, text: readFileSync(join(folder, name), 'utf8') })));
    const all = sources.map((file) => file.text).join('\n');
    const service = sources.find((file) => file.path === 'service.ts')?.text ?? '';
    // One call of the tester in the whole folder, inside `contact`; `contact` is called with the permit of `permitFor` only.
    expect([...all.matchAll(/\btester\s*\.\s*test\s*\(|\.\s*testConnection\s*\(/g)]).toHaveLength(1);
    expect(service.slice(service.indexOf('async function contact('), service.indexOf('/** Seals a secret'))).toMatch(/tester\.test\(candidate\.camera, sealed, deadline\.signal\)/);
    expect([...service.matchAll(/\bcontact\s*\(/g)]).toHaveLength(3); // the definition and the two operations
    expect([...service.matchAll(/await contact\(seams, caller, resolved, permit, /g)]).toHaveLength(2);
    expect([...service.matchAll(/const permit = permitFor\((?:resolved\.)?candidate, credential\);/g)]).toHaveLength(2);
    expect([...service.matchAll(/kind: 'OPERATOR_CREDENTIAL'/g)]).toHaveLength(2); // the type and the one maker
    // An `OperatorCredential` is made at the route edge and nowhere else.
    expect(sources.filter((file) => /\boperatorCredential\s*\(/.test(file.text)).map((file) => file.path).sort()).toEqual(['index.ts', 'service.ts']);
    expect([...(sources.find((file) => file.path === 'index.ts')?.text ?? '').matchAll(/\boperatorCredential\s*\(/g)]).toHaveLength(1);
    // No way back from the store: nothing here opens, reveals or selects a credential, and no default exists.
    expect(all).not.toMatch(/\.\s*open\s*\(|reveal|\bSELECT\b|\bRETURNING\b|defaultCredential|admin/i);
    // Control: the same patterns do see a handler that falls back to a stored value.
    const planted = "const stored = await store.capture.open(deviceId, sealed);\nawait tester.test(candidate.camera, stored ?? DEFAULT, signal);";
    expect([...planted.matchAll(/\btester\s*\.\s*test\s*\(/g)]).toHaveLength(1);
    expect(planted).toMatch(/\.\s*open\s*\(/);
  });

  // Row T3 (review 060c T-08; survivor 13 of its section 6). The control that stood here performed the fallback ITSELF
  // (`testCandidate(..., null).catch(() => testCandidate(..., fallback))`): it passed whatever the product did, also
  // with a product that fell back by itself. It calls only the product now, in ONE world: without a credential the
  // product refuses and the tester double saw nothing; the SAME double then sees the SAME product's call that carries
  // the body's credential - so the 0 is a count that can be 1, and the one credential it ever saw is the body's.
  it('control of the count, in ONE world: the product without a credential reaches the tester 0 times (422); the same product with the body\'s credential is seen ONCE by the same tester, carrying exactly that credential', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    expect(await refusal(testCandidate(w.seams, CALLER, 'CND-000000000001', null))).toEqual([422, 'INVALID_INPUT', 'CREDENTIAL_REQUIRED']);
    expect(w.contacted).toEqual([]);
    later(w);
    const credential = typed();
    expect(await testCandidate(w.seams, CALLER, 'CND-000000000001', credential)).toMatchObject({ outcome: 'REACHABLE', authenticated: true });
    expect(w.contacted).toHaveLength(1);
    expect(w.contacted[0]?.credential).toBe(credential.sealed);
  });
});

describe('M4-CONN-SSRF-1: only a candidate of the caller\'s own live search is ever contacted', () => {
  it('a foreign id, another session\'s id, an untestable, a conflicting, an address-less and a steered candidate: refused with 0 calls and no row', async () => {
    const w = world();
    w.add('CND-00000000000A', camera(), 'SESSION-B');
    w.add('CND-00000000000B', camera({ testable: false }));
    w.add('CND-00000000000C', camera({ conflict: true }));
    w.add('CND-00000000000D', camera({ serviceAddress: null }));
    // A loopback address announced as a production camera (SEC35-41 (a)).
    w.add('CND-00000000000E', camera({ host: '127.0.0.1', serviceAddress: 'http://127.0.0.1/onvif/device_service' }));
    for (const run of [testCandidate, adoptCandidate]) {
      expect(await refusal(run(w.seams, CALLER, 'CND-FFFFFFFFFFFF', typed()))).toEqual([404, 'NOT_FOUND', undefined]);
      expect(await refusal(run(w.seams, CALLER, 'CND-00000000000A', typed()))).toEqual([404, 'NOT_FOUND', undefined]);
      for (const id of ['CND-00000000000B', 'CND-00000000000C', 'CND-00000000000D', 'CND-00000000000E']) {
        expect(await refusal(run(w.seams, CALLER, id, typed())), id).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE']);
      }
    }
    expect(w.contacted).toEqual([]);
    expect(w.audit).toEqual([]);
    // Control: the owner of the foreign candidate does reach it.
    await testCandidate(w.seams, operator('SESSION-B'), 'CND-00000000000A', typed());
    expect(w.contacted).toHaveLength(1);
  });

  it('a candidate the adapter itself refuses (its address is not its own): 409, the Core\'s turn is given back, no row', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    w.answer = new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID);
    expect(await refusal(testCandidate(w.seams, CALLER, 'CND-000000000001', typed()))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE']);
    expect(w.seams.limits.busy()).toBe(false);
    expect(w.audit).toEqual([]);
  });
});

describe('M4-SEC-AUD-1 / SEC35-46: the row of an attempt says where a credential was sent - for a PRODUCTION candidate only', () => {
  it('host and endpointRef for PRODUCTION, neither for DEVELOPMENT; never the account name; the guard\'s mark on the refusal that closes the host', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    w.add('CND-000000000002', development());
    await testCandidate(w.seams, CALLER, 'CND-000000000001', typed());
    later(w);
    await testCandidate(w.seams, CALLER, 'CND-000000000002', typed());
    expect(w.audit.map((entry) => entry.details)).toEqual([
      { candidateId: 'CND-000000000001', searchId: 'DSC-000001', outcome: 'REACHABLE', authenticated: true, adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureCandidateConnection', host: PRODUCTION_HOST, endpointRef: ENDPOINT, permission: 'CAPTURE_CONFIG' },
      { candidateId: 'CND-000000000002', searchId: 'DSC-000001', outcome: 'REACHABLE', authenticated: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', operationId: 'testCaptureCandidateConnection', permission: 'CAPTURE_CONFIG' },
    ]);
    w.answer = { outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 1 };
    later(w);
    await testCandidate(w.seams, CALLER, 'CND-000000000001', typed());
    later(w);
    // Another session, another candidate of the same host: the count is the host's.
    w.add('CND-000000000003', camera(), 'SESSION-B');
    expect(await testCandidate(w.seams, operator('SESSION-B', 'OPR-003'), 'CND-000000000003', typed())).toMatchObject({ failedAttemptsRemaining: 0 });
    expect(w.audit.slice(2).map((entry) => entry.details['guardTripped'])).toEqual([false, true]);
    // The third attempt: 429, 0 calls, no row - whoever asks, and with whatever password.
    later(w);
    const calls = w.contacted.length;
    expect(await refusal(testCandidate(w.seams, CALLER, 'CND-000000000001', typed()))).toEqual([429, 'RATE_LIMITED', 'CONNECTION_TEST_LOCKOUT_GUARD']);
    expect(w.contacted).toHaveLength(calls);
    expect(w.audit).toHaveLength(4);
    // Nothing that was written or noted holds either canary.
    const kept = `${JSON.stringify(w.audit)}\n${JSON.stringify(w.notes)}\n${inspect([...w.candidates.values()], { depth: 8 })}\n${inspect(w.seams.limits, { depth: 8, showHidden: true })}`;
    expect(kept.includes(ACCOUNT.username) || kept.includes(ACCOUNT.secret)).toBe(false);
  });
});

describe('pass D1a (D132): the endpoint reference of an audit row is the URN form or it is absent', () => {
  it('a device that announces any other text gets a row WITHOUT endpointRef - the row is still written, with host', async () => {
    const announced = [ACCOUNT.secret, ACCOUNT.username, 'canary-secret-9d02fa', '[credential]', 'uuid:11111111-2222-3333-4444-555555555555', `${ENDPOINT} x`, 'urn:uuid:not-a-uuid', 'rtsp://192.0.2.40/stream'];
    const w = world();
    announced.forEach((endpointRef, index) => w.add(`CND-0000000000${String(index + 10)}`, camera({ endpointRef, host: `192.0.2.${String(50 + index)}`, serviceAddress: `http://192.0.2.${String(50 + index)}/onvif/device_service` })));
    for (const [index] of announced.entries()) {
      later(w);
      await testCandidate(w.seams, CALLER, `CND-0000000000${String(index + 10)}`, typed());
    }
    expect(w.audit).toHaveLength(announced.length);
    expect(w.audit.map((entry) => 'endpointRef' in entry.details)).toEqual(announced.map(() => false));
    expect(w.audit.map((entry) => entry.details['host'])).toEqual(announced.map((_, index) => `192.0.2.${String(50 + index)}`));
    for (const text of announced) expect(JSON.stringify(w.audit).includes(text)).toBe(false);
    expect(announced.map(auditEndpointRef)).toEqual(announced.map(() => null));
    // Control: the URN form is kept, in either letter case.
    expect([ENDPOINT, ENDPOINT.toUpperCase().replace('URN:UUID:', 'urn:uuid:'), null].map(auditEndpointRef)).toEqual([ENDPOINT, ENDPOINT.toUpperCase().replace('URN:UUID:', 'urn:uuid:'), null]);
  });
});

// Fix F-M4 (review row 69, question 2 / finding R69-05): the form check of the connect flow was a
// second, weaker copy of the store's (33 bytes against 80 and a frame multiple), and "is it really
// sealed" was a byte search that cannot see a short or a re-encoded secret. Now the answer must be
// the STORE'S OWN OBJECT: `isStoreSealedSecret` knows what `sealSecret` returned and nothing else.
describe('question 2: only an answer of the Core credential store is written', () => {
  const adoptWith = async (standIn: World['standInSealer']) => {
    const w = world();
    w.standInSealer = standIn;
    w.add('CND-000000000001', camera());
    await testCandidate(w.seams, CALLER, 'CND-000000000001', typed());
    later(w);
    return adoptCandidate(w.seams, CALLER, 'CND-000000000001', typed()).then(
      (adoption) => adoption.credentialSet,
      (error: unknown) => (error instanceof Error ? error.name : 'not an error'),
    );
  };
  const keyRef = `CAPTURE_DEVICE_K_${'0'.repeat(32)}`;

  it('a stand-in sealer is refused whatever it answers: random bytes of the right form, a secret in another encoding, a short secret beside other bytes, a copy of a real envelope', async () => {
    // Well-formed by every rule the flow had (a key reference of the form, 80 bytes, a 12-byte nonce): accepted before this fix.
    expect(await adoptWith(async () => ({ keyRef, ciphertext: new Uint8Array(randomBytes(80)), nonce: new Uint8Array(12) }))).toBe('SealedCameraSecretRefused');
    // The two cases the byte search could never see (R69-05).
    expect(await adoptWith(async (_device, secret) => ({ keyRef, ciphertext: new Uint8Array(Buffer.concat([Buffer.from(Buffer.from(secret).toString('hex')), randomBytes(80)]).subarray(0, 80)), nonce: new Uint8Array(12) }))).toBe('SealedCameraSecretRefused');
    expect(await adoptWith(async () => ({ keyRef, ciphertext: new Uint8Array(Buffer.concat([Buffer.from('k9'), randomBytes(78)])), nonce: new Uint8Array(12) }))).toBe('SealedCameraSecretRefused');
    // A copy is not the store's object.
    expect(await adoptWith(async (device, secret) => ({ ...(await STORE.capture.seal(device, secret)) }))).toBe('SealedCameraSecretRefused');
  });

  it('CONTROL - the store\'s own answer is written', async () => {
    expect(await adoptWith(null)).toBe(true);
    expect(await adoptWith((device, secret) => STORE.capture.seal(device, secret))).toBe(true);
  });
});

describe('pass D1a (D132, connect.db.test.ts:474): a short secret is not refused by chance, a clear one still is', () => {
  it('10,000 random 80-byte envelopes hold a one-, two- and three-character secret 0 times by the rule; the old rule (bare containment) is hit', () => {
    const envelopes = Array.from({ length: 10_000 }, () => new Uint8Array(randomBytes(80)));
    for (const secret of ['k', 'k9', 'k9!']) expect(envelopes.filter((envelope) => holdsClearSecret(envelope, secret)), secret).toHaveLength(0);
    // Control: the defect. Bare containment of one byte in 80 random bytes is frequent (about 27%).
    expect(envelopes.filter((envelope) => Buffer.from(envelope).includes(Buffer.from('k'))).length).toBeGreaterThan(1_000);
  });

  it('a sealer that hands the frame back in clear is found, for a short and for a long secret, at any offset', () => {
    const clearFrame = (secret: string, offset: number): Uint8Array => {
      const frame = Buffer.alloc(80);
      frame.write(secret, offset, 'utf8');
      return new Uint8Array(frame);
    };
    for (const secret of ['k', 'k9!', 'x'.repeat(CLEAR_SECRET_PROOF_BYTES - 1), 'x'.repeat(CLEAR_SECRET_PROOF_BYTES), ACCOUNT.secret]) {
      for (const offset of [0, 3, 40]) expect(holdsClearSecret(clearFrame(secret, offset), secret), `${String(secret.length)} at ${String(offset)}`).toBe(true);
    }
    // A long secret among random bytes (no zero padding) is found as well; a different one is not.
    // Review 060b S-08 (row T2): the byte that FOLLOWS the secret decides the second answer, so it is stated, not
    // drawn. It was the first of 20 random bytes: 1 run in 256 it was `x`, and the longer text was (rightly) found.
    // The surroundings stay random: the secret cannot stand in them by chance (29 fixed bytes), and one more copy
    // of it could only keep the first answer true.
    const among = (next: string): Buffer => Buffer.concat([randomBytes(20), Buffer.from(ACCOUNT.secret), Buffer.from(next, 'latin1'), randomBytes(19)]);
    const mixed = among('y');
    expect(mixed.byteLength).toBe(20 + Buffer.byteLength(ACCOUNT.secret) + 20);
    expect([holdsClearSecret(mixed, ACCOUNT.secret), holdsClearSecret(mixed, `${ACCOUNT.secret}x`), holdsClearSecret(new Uint8Array(80), '')]).toEqual([true, false, false]);
    // The former 1-in-256 case, on purpose: when the next byte IS `x` the longer text stands there and is found.
    expect([holdsClearSecret(among('x'), ACCOUNT.secret), holdsClearSecret(among('x'), `${ACCOUNT.secret}x`), holdsClearSecret(among('x'), `${ACCOUNT.secret}y`)]).toEqual([true, true, false]);
  });
});

describe('the refusals that come before any request', () => {
  it('409 CAPTURE_CONFIG_LOCKED while a session is open, for 95, 96 and 89: no call, no row', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    w.sessionOpen = true;
    for (const pending of [testCandidate(w.seams, CALLER, 'CND-000000000001', typed()), adoptCandidate(w.seams, CALLER, 'CND-000000000001', typed()), setCredential(w.seams, CALLER, 'CAM-01', typed())]) {
      expect(await refusal(pending)).toEqual([409, 'CAPTURE_CONFIG_LOCKED', undefined]);
    }
    expect(w.contacted).toEqual([]);
    expect(w.audit).toEqual([]);
  });

  it('503 while a seam is not provided: the candidate state, the tester, the sealer (credential writes only), the registrar - each before the tester is called', async () => {
    for (const [missing, run, reason] of [
      ['candidates', (w: World) => testCandidate(w.seams, CALLER, 'CND-000000000001', typed()), 'DISCOVERY_NOT_READY'],
      ['tester', (w: World) => testCandidate(w.seams, CALLER, 'CND-000000000001', typed()), 'DISCOVERY_NOT_READY'],
      ['sealer', (w: World) => adoptCandidate(w.seams, CALLER, 'CND-000000000001', typed()), 'CREDENTIAL_STORE_NOT_READY'],
      ['registrar', (w: World) => adoptCandidate(w.seams, CALLER, 'CND-000000000001', typed()), 'DISCOVERY_NOT_READY'],
      ['sealer', (w: World) => setCredential(w.seams, CALLER, 'CAM-01', typed()), 'CREDENTIAL_STORE_NOT_READY'],
    ] as const) {
      const w = world();
      w.add('CND-000000000001', camera());
      w.candidates.get('CND-000000000001')!.candidate.lastTest = { outcome: 'REACHABLE', authenticated: true, testedAt: w.now, profiles: ['main'] };
      w.provided[missing] = false;
      expect(await refusal(run(w)), missing).toEqual([503, 'NOT_READY', reason]);
      expect(w.contacted, missing).toEqual([]);
      expect(w.audit, missing).toEqual([]);
    }
  });

  it('one test at a time per Core (409), and the spacing (429 with retry-after): 0 calls, no row', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    w.add('CND-000000000002', camera({ host: '192.0.2.41', serviceAddress: 'http://192.0.2.41/onvif/device_service' }), 'SESSION-B');
    w.answer = 'HANG';
    const running = testCandidate(w.seams, CALLER, 'CND-000000000001', typed());
    await Promise.resolve();
    expect(await refusal(testCandidate(w.seams, operator('SESSION-B'), 'CND-000000000002', typed()))).toEqual([409, 'INVALID_STATE', 'CONNECTION_TEST_IN_PROGRESS']);
    // M4-SEC-CONN-3: the whole-test deadline is ONE timer of 15,000 ms; when it fires the signal aborts and the test ends UNREACHABLE.
    expect(w.timers.map((timer) => timer.delayMs)).toEqual([CAPTURE_CONNECTION_TEST_TIMEOUT_MS]);
    expect(CAPTURE_CONNECTION_TEST_TIMEOUT_MS).toBe(15_000);
    expect(w.contacted[0]?.signal.aborted).toBe(false);
    w.timers[0]?.fire();
    expect(w.contacted[0]?.signal.aborted).toBe(true);
    expect(await running).toMatchObject({ outcome: 'UNREACHABLE', failedAttemptsRemaining: 2 });
    expect(w.timers[0]?.cancelled).toBe(true);
    // At once again on the same host: the spacing refuses, and says for how long.
    const error = await testCandidate(w.seams, CALLER, 'CND-000000000001', typed()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiFailure);
    expect([(error as ApiFailure).statusCode, (error as ApiFailure).details?.['reason'], (error as ApiFailure).headers?.['retry-after']]).toEqual([429, 'CONNECTION_TEST_RATE_LIMITED', '5']);
    expect(w.contacted).toHaveLength(1);
    expect(w.audit).toHaveLength(1);
  });
});

describe('M4-CONN-ORDER-1: the flow has one order', () => {
  it('no adoption without a REACHABLE test, nor once its validity has passed; the credential is present exactly when the test was authenticated', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    w.add('CND-000000000002', development());
    expect(await refusal(adoptCandidate(w.seams, CALLER, 'CND-000000000001', typed()))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTED']);
    await testCandidate(w.seams, CALLER, 'CND-000000000001', typed());
    later(w);
    await testCandidate(w.seams, CALLER, 'CND-000000000002', null);
    const calls = w.contacted.length;
    expect(await refusal(adoptCandidate(w.seams, CALLER, 'CND-000000000001', null))).toEqual([422, 'INVALID_INPUT', 'CREDENTIAL_REQUIRED']);
    expect(await refusal(adoptCandidate(w.seams, CALLER, 'CND-000000000002', typed()))).toEqual([422, 'INVALID_INPUT', 'CREDENTIAL_NOT_EXPECTED']);
    // One millisecond before the validity ends the adoption is still possible; at its end it is not.
    w.now = w.candidates.get('CND-000000000002')!.candidate.lastTest!.testedAt + CAPTURE_CONNECTION_TEST_VALIDITY_MS;
    expect(await refusal(adoptCandidate(w.seams, CALLER, 'CND-000000000002', null))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTED']);
    expect(w.contacted).toHaveLength(calls);
    w.now -= 1;
    // A development source without a credential IS adopted: 201 in the route, `credentialSet: false`, the next free id.
    const adoption = await adoptCandidate(w.seams, CALLER, 'CND-000000000002', null);
    expect(adoption).toMatchObject({ deviceId: 'CAM-03', credentialSet: false, device: { id: 'CAM-03', host: '127.0.0.1:8564' } });
    expect(w.audit.slice(-2).map((entry) => entry.type)).toEqual(['CAPTURE_CONNECTION_TESTED', 'CAPTURE_CANDIDATE_ADOPTED']);
    expect(w.audit.at(-1)?.details).toEqual({ deviceId: 'CAM-03', candidateId: 'CND-000000000002', searchId: 'DSC-000001', adapter: 'FAKE', sourceClass: 'DEVELOPMENT', credentialSet: false, operationId: 'adoptCaptureCandidate', permission: 'CAPTURE_CONFIG' });
    expect(w.candidates.get('CND-000000000002')?.candidate.registeredDeviceId).toBe('CAM-03');
    later(w);
    expect(await refusal(adoptCandidate(w.seams, CALLER, 'CND-000000000002', null))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_ALREADY_REGISTERED']);
  });

  // Fix F-M4 (finding R69-03): a production Core does not LIST a stored development device, so the
  // listed state can lack the row with the highest number. An id minted from the list alone would be
  // the id of that stored row, and the registry's upsert would write the new camera over it (the
  // adapter kind of a row is never updated). The id is minted over the stored registry.
  it('the id of an adopted camera is free in the STORED registry, not only in the listed one', async () => {
    const w = world();
    w.storedOnly = ['CAM-03', 'CAM-07'];
    w.add('CND-000000000002', development());
    await testCandidate(w.seams, CALLER, 'CND-000000000002', null);
    later(w);
    const adoption = await adoptCandidate(w.seams, CALLER, 'CND-000000000002', null);
    expect(adoption.deviceId).toBe('CAM-08');
  });

  // Fix F-M4 (review row 69, finding R69-13; decision D178): a camera that asks for a sign-in
  // method the Core does not answer ends as AUTHENTICATION_FAILED (the outcome `cap` §A.6.2 gives
  // it) WITH its reason, so no client words it as a refused credential. Nothing follows it by itself.
  it('R69-13: SCHEME_NOT_ALLOWED travels with the outcome to the answer and to the candidate; one request, no second attempt; a refused credential carries no reason (control)', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    w.answer = { outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 0, reason: 'SCHEME_NOT_ALLOWED' };
    const unanswered = await testCandidate(w.seams, CALLER, 'CND-000000000001', typed());
    expect(unanswered).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED' });
    expect(w.candidates.get('CND-000000000001')?.candidate.lastTest).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED' });
    expect(w.contacted).toHaveLength(1);
    // D181 (3): nothing was sent with a credential, so the guard did not count it and the row does not say it tripped.
    expect(unanswered.failedAttemptsRemaining).toBe(2);
    expect(w.audit.at(-1)?.details).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', guardTripped: false });
    for (let index = 0; index < 4; index += 1) {
      later(w);
      w.now += 60_000;
      expect((await testCandidate(w.seams, CALLER, 'CND-000000000001', typed())).failedAttemptsRemaining).toBe(2);
    }
    // Fix wave I (re-gate 70, finding G70b-05): the audit row of a scheme refusal SAYS SO, with the closed code of
    // the answer - it was the same row as a refused credential's. (Before this wave the row carried no reason member.)
    expect(w.audit.at(-1)?.details).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', authenticated: true, guardTripped: false, reason: 'SCHEME_NOT_ALLOWED' });

    const control = world();
    control.add('CND-000000000001', camera());
    control.answer = { outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 1, reason: 'CREDENTIAL_REFUSED' };
    const refused = await testCandidate(control.seams, CALLER, 'CND-000000000001', typed());
    expect(refused.outcome).toBe('AUTHENTICATION_FAILED');
    expect('reason' in refused).toBe(false);
    expect(refused.failedAttemptsRemaining).toBe(1);
    expect('reason' in (control.candidates.get('CND-000000000001')?.candidate.lastTest ?? {})).toBe(false);
    // CONTROL of the audit member (fix wave I): the row of a REFUSED credential carries no reason.
    expect(Object.keys(control.audit.at(-1)?.details ?? {})).not.toContain('reason');
  });

  it('the next camera id is the highest number plus 1, two digits at least', () => {
    expect(nextCameraId([])).toBe('CAM-01');
    expect(nextCameraId([{ id: 'CAM-01' }, { id: 'MIC-07' }, { id: 'CAM-09' }])).toBe('CAM-10');
    expect(nextCameraId([{ id: 'CAM-99' }, { id: 'CAM-100' }])).toBe('CAM-101');
  });
});

// Task 4 rows 50 and 51 (amendment AM-2; security AD-06 (2), (4); decision C36): what a test JUDGED FROM THE
// STREAM travels from the tester to the registrar as codes of the Core with the ONVIF tokens beside them; what
// the ONVIF half alone read (tokens) is compared and stored nowhere.
describe('task 4 rows 50 and 51: the judged streams of an attempt, and the code rule at the write', () => {
  const HEVC: JudgedStream = { code: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080, onvifProfileToken: 'profile_1', videoSourceToken: 'vs_1', lens: 1 };
  const AVC: JudgedStream = { code: 'H264_720P30', codec: 'H264', width: 1280, height: 720, onvifProfileToken: 'main.stream:1-b', videoSourceToken: null, lens: 2 };
  /** A world whose registrar keeps what it was handed. */
  const registering = (): { w: World; seams: ConnectSeams; handed: AdoptedDevice[] } => {
    const w = world();
    const handed: AdoptedDevice[] = [];
    const seams: ConnectSeams = {
      host: w.seams.host,
      limits: w.seams.limits,
      candidates: w.seams.candidates,
      tester: w.seams.tester,
      sealer: w.seams.sealer,
      storeSealed: w.seams.storeSealed,
      registrar: () => async (_scope, _principal, device) => {
        handed.push(device);
        return { id: device.id, kind: 'CAMERA', model: device.model, firmware: null, host: device.address, poePort: null, online: true, streamState: null, capabilities: ['VIDEO'] };
      },
    };
    return { w, seams, handed };
  };

  it('the registrar is handed the CODES of the streams the re-verification judged, and the streams; the test record keeps the codes; the log line says how many and why not', async () => {
    const { w, seams, handed } = registering();
    w.add('CND-000000000001', camera());
    w.answer = { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, usableProfiles: ['HEVC_1080P', 'H264_720P30'], rejectedCredentialRequests: 0, reason: null, streams: [HEVC, AVC] };
    expect(await testCandidate(seams, CALLER, 'CND-000000000001', typed())).toMatchObject({ outcome: 'REACHABLE', usableProfileCount: 2 });
    expect(w.candidates.get('CND-000000000001')?.candidate.lastTest?.profiles).toEqual(['HEVC_1080P', 'H264_720P30']);
    expect(w.notes.at(-1)).toMatchObject({ outcome: 'REACHABLE', judgedStreams: 2, testReason: null });
    later(w);
    await adoptCandidate(seams, CALLER, 'CND-000000000001', typed());
    expect(handed).toHaveLength(1);
    expect(handed[0]).toMatchObject({ profiles: ['HEVC_1080P', 'H264_720P30'], streams: [HEVC, AVC] });
    // No audit detail of the test or of the adoption holds a token or a code.
    expect(JSON.stringify(w.audit.map((entry) => entry.details))).not.toMatch(/profile_1|main\.stream|HEVC_1080P|H264_720P30/);

    // A test that did not pass: its reason is a code word in the log line; a reason that is no code word is left out.
    const failed = registering();
    failed.w.add('CND-000000000002', camera());
    failed.w.answer = { outcome: CaptureConnectionOutcome.NOT_H264, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 0, reason: 'STREAM_CODEC_NOT_USABLE', streams: [HEVC] };
    expect(await testCandidate(failed.seams, CALLER, 'CND-000000000002', typed())).toMatchObject({ outcome: 'NOT_H264', usableProfileCount: 0 });
    expect(failed.w.notes.at(-1)).toMatchObject({ outcome: 'NOT_H264', judgedStreams: 0, testReason: 'STREAM_CODEC_NOT_USABLE' });
    later(failed.w);
    failed.w.answer = { outcome: CaptureConnectionOutcome.UNREACHABLE, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 0, reason: 'h265<script>' };
    await testCandidate(failed.seams, CALLER, 'CND-000000000002', typed());
    expect(failed.w.notes.at(-1)).toMatchObject({ testReason: null });
  });

  it('a test without a stream half hands the registrar NO code: the tokens it read served the comparison only (C36)', async () => {
    const { w, seams, handed } = registering();
    w.add('CND-000000000001', development());
    w.answer = { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: false, usableProfiles: ['profile_1'], rejectedCredentialRequests: 0 };
    await testCandidate(seams, CALLER, 'CND-000000000001', null);
    later(w);
    await adoptCandidate(seams, CALLER, 'CND-000000000001', null);
    expect(handed[0]).toMatchObject({ profiles: [], streams: [] });
    // A stream set that changed between the two attempts is the changed device of the contract.
    const changed = registering();
    changed.w.add('CND-000000000002', camera());
    changed.w.answer = { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, usableProfiles: ['H264_720P30'], rejectedCredentialRequests: 0, streams: [AVC] };
    await testCandidate(changed.seams, CALLER, 'CND-000000000002', typed());
    later(changed.w);
    changed.w.answer = { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, usableProfiles: ['HEVC_1080P'], rejectedCredentialRequests: 0, streams: [HEVC] };
    expect(await refusal(adoptCandidate(changed.seams, CALLER, 'CND-000000000002', typed()))).toEqual([409, 'INVALID_STATE', 'CONNECTION_TEST_FAILED']);
    expect(changed.handed).toEqual([]);
  });

  it('AD-06 (4) in code: a profile list is the codes of its streams, each of the code pattern; an ONVIF token, a lower-case or over-long text, a list that is not the streams and a stream outside its bounds are refused before any statement', async () => {
    const accepted: Parameters<typeof assertAdoptedProfiles>[0][] = [
      { profiles: [], streams: [] },
      { profiles: ['HEVC_1080P'], streams: [HEVC] },
      { profiles: ['H264_720P30', 'HEVC_1080P'], streams: [HEVC, AVC] },
    ];
    for (const device of accepted) expect(() => assertAdoptedProfiles(device)).not.toThrow();
    const refused: Parameters<typeof assertAdoptedProfiles>[0][] = [
      { profiles: ['profile_1'], streams: [] },
      { profiles: ['profile_1'], streams: [{ ...HEVC, code: 'profile_1' }] },
      { profiles: ['HEVC_1080P'], streams: [] },
      { profiles: [], streams: [HEVC] },
      { profiles: ['HEVC_1080P', 'HEVC_1080P'], streams: [HEVC, HEVC] },
      { profiles: ['HEVC_1080P', 'H264_720P30'], streams: [HEVC, { ...AVC, code: 'HEVC_1080P' }] },
      { profiles: ['hevc_1080p'], streams: [{ ...HEVC, code: 'hevc_1080p' }] },
      { profiles: [`HEVC_${'9'.repeat(64)}`], streams: [{ ...HEVC, code: `HEVC_${'9'.repeat(64)}` }] },
      { profiles: ['HEVC_1080P<script>'], streams: [{ ...HEVC, code: 'HEVC_1080P<script>' }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, onvifProfileToken: 'profile 1' }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, onvifProfileToken: 'x'.repeat(65) }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, videoSourceToken: '<vs>' }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, codec: 'OTHER' }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, codec: 'H264' }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, lens: 0 }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, lens: 5 }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, width: 0 }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, height: 16_385 }] },
      { profiles: ['HEVC_1080P'], streams: [{ ...HEVC, width: 1920.5 }] },
      { profiles: [7 as unknown as string], streams: [] },
    ];
    for (const device of refused) expect(() => assertAdoptedProfiles(device), JSON.stringify(device)).toThrow(AdoptionProfileInvalid);
    // The refusal names the rule, never the value.
    const thrown = (() => {
      try {
        assertAdoptedProfiles({ profiles: ['HEVC_1080P<script>'], streams: [] });
      } catch (error) {
        return error as Error & { code?: string };
      }
      return null;
    })();
    expect(thrown?.code).toBe('CAPTURE_ADOPTION_PROFILE_INVALID');
    expect(`${String(thrown?.message)} ${String(thrown?.stack)}`).not.toMatch(/script|HEVC_1080P/);
    // The writer sends no statement for a refused device.
    const sent: string[] = [];
    await expect(writeAdoptedCameraStreams({ query: async (text: string) => (sent.push(text), { rows: [], rowCount: 1 }) } as never, { id: 'CAM-03', profiles: ['profile_1'], streams: [{ ...HEVC, code: 'profile_1' }], at: 1 })).rejects.toBeInstanceOf(AdoptionProfileInvalid);
    expect(sent).toEqual([]);
    await writeAdoptedCameraStreams({ query: async (text: string) => (sent.push(text), { rows: [], rowCount: 1 }) } as never, { id: 'CAM-03', profiles: ['HEVC_1080P', 'H264_720P30'], streams: [HEVC, AVC], at: 1 });
    expect(sent).toEqual([INSERT_ADOPTED_CAMERA_STREAM, INSERT_ADOPTED_CAMERA_STREAM]);
  });
});

// Task 4 row 143c (decision C65; S13-11 point 2): under capture operation REAL_PRODUCTION the test of a candidate that is
// NOT STORED YET is made from the camera-interface address, or is not made. THE RULE OF THESE CASES IS THE PRODUCT'S
// (`storedCameraAddressRuleOf` of the fence: `decideDestination`, purpose STORED_CAMERA) on hand-written host facts: a
// camera interface 192.168.50.1 in 192.168.50.0/24 and an office interface 10.20.0.5 in 10.20.0.0/24 (the facts of the
// stored-address cases of the camera adapter). No address is contacted: the tester is a spy.
describe('row 143c (C65): in production a candidate is tested from the camera interface, or not at all; elsewhere the flow is as it was', () => {
  const CAMERA_INTERFACE = '192.168.50.1';
  const OFFICE_ADDRESS = '10.20.0.5';
  /** A candidate inside the camera subnet of these facts. */
  const SUBNET_HOST = '192.168.50.20';
  const subnetCamera = (overrides: Partial<CameraCandidate> = {}): CameraCandidate => camera({ host: SUBNET_HOST, serviceAddress: `http://${SUBNET_HOST}/onvif/device_service`, ...overrides });
  const FACTS: DestinationContext = Object.freeze({
    cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
    cameraAddresses: [{ address: CAMERA_INTERFACE, alias: false }],
    otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
    // R-FLEX NW-C1 (row 104): every eligible interface of the host - STORED_CAMERA is global (RM-N1..RM-N4).
    interfaceSubnets: [
      { name: 'eth0', address: CAMERA_INTERFACE, network: '192.168.50.0', prefixLength: 24 },
      { name: 'eth1', address: OFFICE_ADDRESS, network: '10.20.0.0', prefixLength: 24 },
    ],
    hostAddresses: [OFFICE_ADDRESS],
  });
  const CONFIGURED = storedCameraAddressRuleOf(() => FACTS);
  /** R-FLEX 90 AC-1 (row 104): a Core whose camera network is NOT chosen - no camera subnet, no camera address - and one Wi-Fi interface. */
  const WIFI_ADDRESS = '192.168.0.73';
  const WIFI_ONLY = storedCameraAddressRuleOf(() =>
    Object.freeze({ cameraSubnet: null, cameraAddresses: [], otherInterfaceSubnets: [], interfaceSubnets: [{ name: 'wlp3s0', address: WIFI_ADDRESS, network: '192.168.0.0', prefixLength: 24 }], hostAddresses: [WIFI_ADDRESS] }),
  );
  /** A production Core whose network configuration is absent: the reader answers null. */
  const NOT_CONFIGURED = storedCameraAddressRuleOf(() => null);

  interface Bound {
    readonly w: World;
    readonly seams: ConnectSeams;
    /** Every address the tester was bound to, in order. */
    readonly boundTo: string[];
    /** Calls of the UNBOUND `test` of the tester: must stay 0 where a bound test is required. */
    readonly unboundCalls: { host: string }[];
    /** Calls of a bound test: the host, the address it was bound to, and how many arguments the call carried. */
    readonly boundCalls: { host: string; from: string; given: number }[];
  }
  /** A world whose seams state the binding, and whose tester records how it was reached. `bindable: false`: a tester without `boundTo`. */
  function boundWorld(binding: CandidateSourceBinding | 'LEFT_OUT', bindable = true): Bound {
    const w = world();
    const boundTo: string[] = [];
    const unboundCalls: Bound['unboundCalls'] = [];
    const boundCalls: Bound['boundCalls'] = [];
    const answer = (): Promise<ConnectionAttempt> => (w.answer instanceof Error ? Promise.reject(w.answer) : Promise.resolve(w.answer as ConnectionAttempt));
    const tester: ConnectionTester = {
      test: (device) => {
        unboundCalls.push({ host: device.host });
        return answer();
      },
      ...(bindable
        ? {
            boundTo: (fromAddress: string) => {
              boundTo.push(fromAddress);
              return {
                test: (...given: [CameraCandidate, SealedCredential | null, AbortSignal]) => {
                  boundCalls.push({ host: given[0].host, from: fromAddress, given: given.length });
                  return answer();
                },
              };
            },
          }
        : {}),
    };
    const seams: ConnectSeams = { ...w.seams, tester: () => tester, ...(binding === 'LEFT_OUT' ? {} : { candidateSource: () => binding }) };
    return { w, seams, boundTo, unboundCalls, boundCalls };
  }
  const untouched = (b: Bound): void => {
    expect([b.boundTo, b.unboundCalls, b.boundCalls, b.w.audit]).toEqual([[], [], [], []]);
    expect(b.seams.limits.busy()).toBe(false);
  };

  it('REAL_PRODUCTION, the network configured: operation 95 and the re-verification of operation 96 each bind the tester to the camera-interface address and make ONE bound test; the unbound test is never called', async () => {
    const b = boundWorld({ required: true, rule: CONFIGURED });
    b.w.add('CND-000000000001', subnetCamera());
    expect(await testCandidate(b.seams, CALLER, 'CND-000000000001', typed())).toMatchObject({ outcome: 'REACHABLE', authenticated: true });
    later(b.w);
    expect(await adoptCandidate(b.seams, CALLER, 'CND-000000000001', typed())).toMatchObject({ deviceId: 'CAM-03', credentialSet: true });
    expect(b.boundTo).toEqual([CAMERA_INTERFACE, CAMERA_INTERFACE]);
    expect(b.boundCalls).toEqual([
      { host: SUBNET_HOST, from: CAMERA_INTERFACE, given: 3 },
      { host: SUBNET_HOST, from: CAMERA_INTERFACE, given: 3 },
    ]);
    expect(b.unboundCalls).toEqual([]);
    expect(b.w.audit.map((entry) => entry.type)).toEqual(['CAPTURE_CONNECTION_TESTED', 'CAPTURE_CONNECTION_TESTED', 'CAPTURE_CREDENTIAL_SET', 'CAPTURE_CANDIDATE_ADOPTED']);
  });

  // R-FLEX U4 / RF-N3 (row 104): the F3-06 branch (row R2, C93) is GONE - an empty network configuration no longer refuses
  // (case below), and a rule that still answers `NOT_CONFIGURED` (host facts that cannot be read) is CANDIDATE_NOT_TESTABLE
  // like every other refusal. The status, the code, the order and the log line are as they were.
  it('REAL_PRODUCTION, host facts that cannot be read: the rule refuses (`NOT_CONFIGURED`) - 409 CANDIDATE_NOT_TESTABLE (never COMMISSIONING_NOT_CONFIGURED) before the bounds, nothing bound, nothing sent, no audit row; the log names the rule\'s word and no address', async () => {
    const b = boundWorld({ required: true, rule: NOT_CONFIGURED });
    b.w.add('CND-000000000001', subnetCamera());
    const told = await testCandidate(b.seams, CALLER, 'CND-000000000001', typed()).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(told).toBeInstanceOf(ApiFailure);
    expect([(told as ApiFailure).statusCode, (told as ApiFailure).code, (told as ApiFailure).details]).toEqual([409, 'INVALID_STATE', { reason: 'CANDIDATE_NOT_TESTABLE' }]);
    expect((told as ApiFailure).message).toBe('This device cannot be tested.');
    expect((told as ApiFailure).message.includes(SUBNET_HOST)).toBe(false);
    untouched(b);
    expect(b.w.notes).toEqual([{ code: CANDIDATE_TEST_ADDRESS_REFUSED, source: 'captureConnect', operationId: 'testCaptureCandidateConnection', refusal: 'NOT_CONFIGURED' }]);
    expect(JSON.stringify(b.w.notes).includes(SUBNET_HOST)).toBe(false);
    // The refusal spent nothing: a test straight after it is not "too soon", it is refused the same way.
    expect(await refusal(testCandidate(b.seams, CALLER, 'CND-000000000001', typed()))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE']);
    // An adoption is refused at the same place: its re-verification is the same one function.
    const adopting = boundWorld({ required: true, rule: NOT_CONFIGURED });
    adopting.w.add('CND-000000000001', subnetCamera());
    adopting.w.candidates.get('CND-000000000001')!.candidate.lastTest = { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, testedAt: adopting.w.now, profiles: ['main'] };
    expect(await refusal(adoptCandidate(adopting.seams, CALLER, 'CND-000000000001', typed()))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE']);
    untouched(adopting);
    expect(adopting.w.notes.map((note) => `${String(note['operationId'])} ${String(note['refusal'])}`)).toEqual(['adoptCaptureCandidate NOT_CONFIGURED']);
  });

  it('R-FLEX (row 104, RF-N3, 90 AC-1): REAL_PRODUCTION with an EMPTY camera network configuration - a Wi-Fi candidate reaches the tester bound to the Wi-Fi address; ONE bound test, the unbound test never called', async () => {
    const b = boundWorld({ required: true, rule: WIFI_ONLY });
    const host = '192.168.0.50';
    b.w.add('CND-000000000001', camera({ host, serviceAddress: `http://${host}/onvif/device_service` }));
    expect(await testCandidate(b.seams, CALLER, 'CND-000000000001', typed())).toMatchObject({ outcome: 'REACHABLE', authenticated: true });
    expect(b.boundTo).toEqual([WIFI_ADDRESS]);
    expect(b.boundCalls).toEqual([{ host, from: WIFI_ADDRESS, given: 3 }]);
    expect(b.unboundCalls).toEqual([]);
    expect(b.w.notes.some((note) => note['code'] === CANDIDATE_TEST_ADDRESS_REFUSED)).toBe(false);
    expect(b.w.audit.map((entry) => entry.type)).toEqual(['CAPTURE_CONNECTION_TESTED']);
  });

  it('REAL_PRODUCTION: every address the rule refuses is refused the same way - the host itself, no interface holds it, a port outside the list', async () => {
    const cases: readonly [string, CameraCandidate, string][] = [
      ['an address of the host', camera({ host: OFFICE_ADDRESS, serviceAddress: `http://${OFFICE_ADDRESS}/onvif/device_service` }), 'HOST_ADDRESS'],
      ['a port that is not listed', subnetCamera({ serviceAddress: `http://${SUBNET_HOST}:8080/onvif/device_service` }), 'PORT_NOT_LISTED'],
      ['a service address on another host', subnetCamera({ serviceAddress: 'http://192.168.50.21/onvif/device_service' }), 'STORED_ADDRESS_MALFORMED'],
      ['a public address (the documentation range)', camera(), 'PUBLIC_ADDRESS'],
    ];
    for (const [label, device, word] of cases) {
      const b = boundWorld({ required: true, rule: CONFIGURED });
      b.w.add('CND-000000000001', device);
      expect(await refusal(testCandidate(b.seams, CALLER, 'CND-000000000001', typed())), label).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE']);
      untouched(b);
      expect(b.w.notes.map((note) => note['refusal']), label).toEqual([word]);
    }
    // An address outside the camera subnet: refused by a word of the rule, whichever it is - never tested.
    const outside = boundWorld({ required: true, rule: CONFIGURED });
    outside.w.add('CND-000000000001', camera({ host: '198.51.100.9', serviceAddress: 'http://198.51.100.9/onvif/device_service' }));
    expect(await refusal(testCandidate(outside.seams, CALLER, 'CND-000000000001', typed()))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE']);
    untouched(outside);
    // R-FLEX NW-R1 (row 104): a private address no interface holds on-link - never tested.
    const offLink = boundWorld({ required: true, rule: CONFIGURED });
    offLink.w.add('CND-000000000001', camera({ host: '172.16.9.9', serviceAddress: 'http://172.16.9.9/onvif/device_service' }));
    expect(await refusal(testCandidate(offLink.seams, CALLER, 'CND-000000000001', typed()))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE']);
    untouched(offLink);
    expect(offLink.w.notes.map((note) => note['refusal'])).toEqual(['NO_SOURCE_INTERFACE']);
  });

  it('R-FLEX (row 104; RM-N1 lifted): a candidate on ANOTHER interface\'s subnet (was OTHER_INTERFACE_SUBNET) is tested from THAT interface\'s address', async () => {
    const b = boundWorld({ required: true, rule: CONFIGURED });
    b.w.add('CND-000000000001', camera({ host: '10.20.0.77', serviceAddress: 'http://10.20.0.77/onvif/device_service' }));
    expect(await testCandidate(b.seams, CALLER, 'CND-000000000001', typed())).toMatchObject({ outcome: 'REACHABLE', authenticated: true });
    expect(b.boundTo).toEqual([OFFICE_ADDRESS]);
    expect(b.unboundCalls).toEqual([]);
  });

  it('REAL_PRODUCTION: an admission that names no source address, a rule that was never handed in, a tester that cannot be bound and a tester that refuses the address - each makes NO test', async () => {
    const admitsWithoutSource = boundWorld({ required: true, rule: (host) => ({ allowed: true, destination: { address: host } }) });
    admitsWithoutSource.w.add('CND-000000000001', subnetCamera());
    expect(await refusal(testCandidate(admitsWithoutSource.seams, CALLER, 'CND-000000000001', typed()))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE']);
    untouched(admitsWithoutSource);
    expect(admitsWithoutSource.w.notes.map((note) => note['refusal'])).toEqual(['STORED_ADDRESS_SOURCE_ABSENT']);

    const noRule = boundWorld({ required: true, rule: null });
    noRule.w.add('CND-000000000001', subnetCamera());
    expect(await refusal(testCandidate(noRule.seams, CALLER, 'CND-000000000001', typed()))).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
    untouched(noRule);

    const cannotBind = boundWorld({ required: true, rule: CONFIGURED }, false);
    cannotBind.w.add('CND-000000000001', subnetCamera());
    expect(await refusal(testCandidate(cannotBind.seams, CALLER, 'CND-000000000001', typed()))).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
    untouched(cannotBind);

    const refusesTheAddress = boundWorld({ required: true, rule: CONFIGURED });
    const refusingTester: ConnectionTester = {
      test: () => Promise.reject(new Error('the unbound test must not be called')),
      boundTo: () => {
        throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID);
      },
    };
    refusesTheAddress.w.add('CND-000000000001', subnetCamera());
    expect(await refusal(testCandidate({ ...refusesTheAddress.seams, tester: () => refusingTester }, CALLER, 'CND-000000000001', typed()))).toEqual([409, 'INVALID_STATE', 'CANDIDATE_NOT_TESTABLE']);
    untouched(refusesTheAddress);
  });

  it('REAL_PRODUCTION: the refusals of before still come first - a credential is required, the lock is held, the candidate is another session\'s - and the rule is not asked for them', async () => {
    let asked = 0;
    const b = boundWorld({
      required: true,
      rule: (host, port) => {
        asked += 1;
        return CONFIGURED(host, port);
      },
    });
    b.w.add('CND-000000000001', subnetCamera());
    expect(await refusal(testCandidate(b.seams, CALLER, 'CND-000000000001', null))).toEqual([422, 'INVALID_INPUT', 'CREDENTIAL_REQUIRED']);
    expect(await refusal(testCandidate(b.seams, operator('SESSION-B'), 'CND-000000000001', typed()))).toEqual([404, 'NOT_FOUND', undefined]);
    b.w.sessionOpen = true;
    expect(await refusal(testCandidate(b.seams, CALLER, 'CND-000000000001', typed()))).toEqual([409, 'CAPTURE_CONFIG_LOCKED', undefined]);
    expect(asked).toBe(0);
    untouched(b);
  });

  it('any other capture operation (`required: false`), and seams that state nothing: the tester is called as it is, unbound, with exactly the three arguments of before - no rule is asked, no address is refused', async () => {
    for (const binding of [{ required: false } as const, 'LEFT_OUT' as const]) {
      const b = boundWorld(binding);
      // A candidate no production rule would admit (loopback, a development source) and one on an office subnet: both tested, as before.
      b.w.add('CND-000000000001', development());
      b.w.add('CND-000000000002', camera({ host: '10.20.0.77', serviceAddress: 'http://10.20.0.77/onvif/device_service' }));
      expect(await testCandidate(b.seams, CALLER, 'CND-000000000001', null)).toMatchObject({ outcome: 'REACHABLE', authenticated: false });
      later(b.w);
      expect(await testCandidate(b.seams, CALLER, 'CND-000000000002', typed())).toMatchObject({ outcome: 'REACHABLE', authenticated: true });
      expect(b.unboundCalls).toEqual([{ host: '127.0.0.1' }, { host: '10.20.0.77' }]);
      expect([b.boundTo, b.boundCalls]).toEqual([[], []]);
      expect(b.w.notes.some((note) => note['code'] === CANDIDATE_TEST_ADDRESS_REFUSED)).toBe(false);
    }
  });

  it('the static half: the one maker of the seams of an app ALWAYS states the binding, from the capture operation; the flow asks it once, before the bounds; the one call of the tester is unchanged', () => {
    const folder = join(import.meta.dirname, '..');
    const index = readFileSync(join(folder, 'index.ts'), 'utf8');
    const service = readFileSync(join(folder, 'service.ts'), 'utf8');
    expect(index).toContain('const production = isProductionCaptureOperation(captureOperationOf(app.config));');
    expect(index.match(/\bcandidateSource\s*:/g)).toHaveLength(1);
    expect(index).toContain('candidateSource: () => (production ? { required: true, rule: control.candidateRule } : { required: false }),');
    // The rule has ONE way in (the composition's door); a test's `replaceForTest` cannot set it.
    expect(index.match(/\.candidateRule\s*=(?![=>])/g)).toBeNull();
    expect(index.match(/provide\('candidateRule', /g)).toHaveLength(1);
    const contact = service.slice(service.indexOf('async function contact('), service.indexOf('/**\n * The endpoint reference'));
    expect(contact.indexOf('const tester = testerOf(seams, resolved, operationId);')).toBeGreaterThan(0);
    expect(contact.indexOf('const tester = testerOf(seams, resolved, operationId);')).toBeLessThan(contact.indexOf('limits.refusal('));
    expect(service.match(/\btesterOf\s*\(/g)).toHaveLength(2); // the definition and the one call
    expect(service.match(/\bseams\.candidateSource\b/g)).toHaveLength(1);
    expect(contact).toContain('attempt = await tester.test(candidate.camera, sealed, deadline.signal);');
  });
});
