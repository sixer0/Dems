// The connect flow on doubles: no database, no socket (blueprint row 142; checks M4-CONN-NOCRED-1,
// M4-CONN-SSRF-1, M4-CONN-ORDER-1 (unit half), M4-SEC-AUD-1, M4-SEC-RATE-1 through the service,
// M4-SEC-CONN-3 (the deadline on a manual clock); contract C3 §2.6; D76, D86 C-3; SEC35-34).
//
// The tester is a SPY: it records every call and what it was handed, and answers what the test
// says. A PRODUCTION candidate has a documentation address (RFC 5737) that nothing ever contacts.
// The routes and the transaction are proven in `connect.db.test.ts`. EVERY RULE HAS ITS CONTROL.
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { CAPTURE_CONNECTION_TEST_TIMEOUT_MS, CAPTURE_CONNECTION_TEST_VALIDITY_MS, CaptureConnectionOutcome } from '@dems/shared/api';
import type { AuditRow } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { codeOnly } from '../../../../../test/static/scan';
import { CaptureAdapterError, CaptureAdapterKind, CaptureAdapterRefusal, sealCredential, usingCredential, type CameraCandidate, type SealedCredential } from '../../../../capture/adapters';
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
  type CandidateTestRecord,
  type ConnectCaller,
  type ConnectCandidate,
  type ConnectSeams,
  type ConnectionAttempt,
} from '../service';

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
    now: 1_800_000_000_000,
    provided: { candidates: true, tester: true, sealer: true, registrar: true },
    add(candidateId, device, owner = 'SESSION-A') {
      state.candidates.set(candidateId, { owner, candidate: { candidateId, searchId: 'DSC-000001', camera: device, registeredDeviceId: null, lastTest: null } });
    },
    seams: undefined as unknown as ConnectSeams,
  };
  const unit = { audit: { append: async (entry: AuditEntry) => (state.audit.push(entry), {} as AuditRow) }, query: async () => ({ rows: [], rowCount: 0 }) } as unknown as UnitContext;
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
    sealer: () => (state.provided.sealer ? { seal: async () => ({ keyRef: 'CAPTURE_DEVICE_K_TEST', ciphertext: new Uint8Array(48), nonce: new Uint8Array(12) }) } : null),
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

  it('control: a flow that falls back to a stored credential DOES reach the tester - which is what the 422 above rules out', async () => {
    const w = world();
    w.add('CND-000000000001', camera());
    const fallback = operatorCredential(sealCredential({ username: 'stored', secret: 'stored' }));
    await testCandidate(w.seams, CALLER, 'CND-000000000001', null).catch(() => testCandidate(w.seams, CALLER, 'CND-000000000001', fallback));
    expect(w.contacted).toHaveLength(1);
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
    const mixed = Buffer.concat([randomBytes(20), Buffer.from(ACCOUNT.secret), randomBytes(20)]);
    expect([holdsClearSecret(mixed, ACCOUNT.secret), holdsClearSecret(mixed, `${ACCOUNT.secret}x`), holdsClearSecret(new Uint8Array(80), '')]).toEqual([true, false, false]);
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

  it('the next camera id is the highest number plus 1, two digits at least', () => {
    expect(nextCameraId([])).toBe('CAM-01');
    expect(nextCameraId([{ id: 'CAM-01' }, { id: 'MIC-07' }, { id: 'CAM-09' }])).toBe('CAM-10');
    expect(nextCameraId([{ id: 'CAM-99' }, { id: 'CAM-100' }])).toBe('CAM-101');
  });
});
