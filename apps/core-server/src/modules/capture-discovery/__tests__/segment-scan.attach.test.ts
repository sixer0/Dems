// DECISION D62b (2026-11-05): the SMART ATTACH defects the bench found, proven over the REAL services.
//
// `segment-scan.test.ts` mocks the attach boundary - that is why the bench failure escaped it. This file wires
// the REAL `systemFlow` door of the connect flow (`../connect/index.ts` -> the REAL operations 95/96 of
// `service.ts` on REAL `createConnectionTestLimits` and the REAL candidate store) over a FAKE ONVIF responder
// (the `ConnectionTester` seam answers REACHABLE without a socket), a fake engine/pipeline unit and the Core's
// own credential store for the sealing. No database, no socket, no wall clock: one manual clock drives the
// sweeper, the directory and the limits alike.
//
// What stands here:
//   ROOT CAUSE (A): an auto-attach spends TWO connection tests on one candidate - operation 95's test and
//     operation 96's re-verification - back to back, where an operator's hands would put seconds between them.
//     The Core's own spacing bound (`CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS`, per host AND per session key)
//     refuses the second inside the same window: the bench's first-attempt `429 RATE_LIMITED` with reason
//     `CONNECTION_TEST_RATE_LIMITED`, refused BEFORE anything was sent.
//   THE FIX (A): `systemFlow` obeys the limiter's own ask (`refusal.retryAfterMs`, capped by
//     `AUTOATTACH_TEST_PACING_CAP_MS`) before each step instead of raising or bypassing any bound; one sweep
//     then tests, waits, re-verifies, adopts and assigns.
//   RETRY (B): an unadopted SEGMENT-origin candidate is CARRIED into the next sweep's list and re-attempted
//     although its host is never re-probed (the dedupe rules probing, not attaching), up to
//     `AUTOATTACH_MAX_ATTACH_ATTEMPTS` attempts per host; at the cap the sweep gives up until the candidate's
//     TTL has passed, and the failed-attach warn line now says the refusal REASON word.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { ApiErrorCode, CAPTURE_DISCOVERY_RESULT_TTL_MS, CaptureConnectionOutcome, CaptureDiscoveryReason, CaptureDiscoveryTrigger } from '@dems/shared/api';
import { afterAll, describe, expect, it } from 'vitest';
import { CREDENTIAL_MARK, sealCredential, type CameraCandidate, type SealedCredential } from '../../../capture/adapters';
import { Secret } from '../../../config';
import type { AuditEntry, UnitContext } from '../../../core';
import { ApiFailure } from '../../../plugins/error-envelope';
import { createCredentialStore } from '../../../credential-store';
import { createCandidateStore, type CandidateStore } from '../store';
import { AUTOATTACH_MAX_ATTACH_ATTEMPTS, SYSTEM_OWNER_SESSION_ID, autoSearchIdOf, createSegmentSweeper, foundOfProbe, type SegmentAttach, type SegmentSweepOptions } from '../segment-scan';
import { AUTOATTACH_TEST_PACING_CAP_MS, candidateDirectoryOf, createConnectionTestLimits, registerCaptureConnectRoutes, type CaptureConnectControl } from '../connect';

// The sealing runs on the Core's own store (fix F-M4's rule: the connect flow takes no other answer); its key
// files live in a directory of this file, removed at the end - the idiom of `connect/__tests__/service.test.ts`.
const STORE_ROOT = mkdtempSync(join(tmpdir(), 'dems-d62b-attach-'));
afterAll(() => rmSync(STORE_ROOT, { recursive: true, force: true }));
const CREDENTIAL_STORE = createCredentialStore({ root: join(STORE_ROOT, 'credential-store') });

const SEGMENT = '192.0.2.0/24';
const HOST = '192.0.2.117';
const T0 = 1_800_000_000_000;
const ACCOUNT = { username: 'd62bBench', secret: 'd62bSecret-9f3a1c' };

/** The store's minting idiom of the folder's tests: six bytes, the last one counting up. */
const counterBytes = (): ((size: number) => Uint8Array) => {
  let next = 0;
  return (size: number) => Uint8Array.from({ length: size }, (_unused, index) => (index === size - 1 ? (next += 1) : 7));
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// ── The world: real sweeper, real store, real connect flow, fake outside worlds ────────────────

interface AttachWorld {
  readonly nowMs: number;
  readonly waits: number[];
  readonly testerCalls: { host: string; credential: boolean }[];
  readonly audit: AuditEntry[];
  /** Row 103: every app log line and error-log row of the world, as handed to the logger. */
  readonly lines: unknown[];
  readonly connect: CaptureConnectControl;
  readonly store: CandidateStore;
  advance(ms: number): void;
}

/**
 * One world. `registerCaptureConnectRoutes` over a hand-made app stand: the routes are captured and dropped,
 * the seams are provided for real (the store's directory, a scripted tester, the credential store's sealer, a
 * fake registrar), and the limits are the REAL ones on this world's manual clock. The capture operation reads
 * REAL_DEVELOPMENT (`captureDevSources`), so no destination rule binds the fake tester.
 */
function world(segmentCidr: string | null = SEGMENT): AttachWorld {
  const state: Mutable<Omit<AttachWorld, 'connect' | 'store' | 'advance'>> = { nowMs: T0, waits: [], testerCalls: [], audit: [], lines: [] };
  const store = createCandidateStore({ randomBytes: counterBytes() });
  const slices = () => ({
    session: null,
    captureDevices: { devices: [{ id: 'CAM-01', kind: 'CAMERA', host: '192.0.2.1' }, { id: 'CAM-02', kind: 'CAMERA', host: '192.0.2.2' }] },
    captureConfig: { cameras: [], mics: [], locked: false, updatedAt: 1 },
  });
  const unit = {
    id: 1,
    audit: { append: async (entry: AuditEntry) => (state.audit.push(entry), {} as never) },
    events: { append: async () => ({}) },
    query: async () => ({ rows: [], rowCount: 0 }),
    afterCommit: (task: () => void) => task(),
    db: {},
  } as unknown as UnitContext;
  const app = {
    stages: {},
    clock: { now: () => state.nowMs },
    config: { captureMode: 'real', captureDevSources: true, host: '127.0.0.1', demoControls: false, cameraSegmentCidr: segmentCidr },
    addHook: () => undefined,
    log: { info: (fields: unknown, message: unknown) => void state.lines.push({ fields, message }), warn: (fields: unknown, message: unknown) => void state.lines.push({ fields, message }), error: (fields: unknown, message: unknown) => void state.lines.push({ fields, message }) },
    errorLog: { append: (entry: unknown) => void state.lines.push(entry) },
    engine: {
      state: () => slices() as never,
      run: async (_label: string, work: (scope: unknown) => Promise<unknown>) => ({ value: await work({ pending: () => slices(), unit, command: async () => undefined }), epoch: 1, revision: 1 }),
    },
    pipeline: { run: async (_label: string, work: (u: UnitContext) => Promise<unknown>) => await work(unit) },
    withTypeProvider: () => ({ route: () => undefined }),
  };
  const connect = registerCaptureConnectRoutes(app as never, { limits: createConnectionTestLimits({ now: () => state.nowMs }) });
  connect.provideCandidates(candidateDirectoryOf(store, () => state.nowMs));
  connect.provideTester({
    test: async (camera: CameraCandidate, credential: SealedCredential | null) => {
      state.testerCalls.push({ host: camera.host, credential: credential !== null });
      return { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: credential !== null, usableProfiles: ['main'], rejectedCredentialRequests: 0 };
    },
  });
  connect.provideSealer({ seal: (deviceId, secret) => CREDENTIAL_STORE.capture.seal(deviceId, secret) });
  connect.provideRegistrar(async (_scope, _principal, device) => ({ id: device.id, kind: 'CAMERA', model: device.model, firmware: null, host: device.address, poePort: null, online: true, streamState: null, capabilities: ['VIDEO'] } as never));
  return Object.assign(state, {
    store,
    connect,
    advance(ms: number) {
      state.nowMs += ms;
    },
  }) as AttachWorld;
}

/** The one candidate of the world: an ONVIF answer on HOST, listed through the sweep's own door. */
function seedCandidate(store: CandidateStore, at: number): string {
  store.begin({ sessionId: SYSTEM_OWNER_SESSION_ID, searchId: autoSearchIdOf(at, 1), trigger: CaptureDiscoveryTrigger.AUTO, startedAt: at, windowMs: 0, interfaceCount: 1 });
  store.complete(autoSearchIdOf(at, 1), [foundOfProbe(HOST, { onvif: true, rtsp: false })], { responderCount: 1, interfaceCount: 1, truncated: false, completedAt: at });
  const candidate = store.stateOf(SYSTEM_OWNER_SESSION_ID, at).candidates[0];
  if (candidate === undefined) throw new Error('the seed left no candidate');
  return candidate.candidateId;
}

const failureOf = async (pending: Promise<unknown>): Promise<ApiFailure> => {
  const error: unknown = await pending.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiFailure)) throw new Error(`expected a refusal, got ${error === null ? 'an answer' : String(error)}`);
  return error;
};

// ── A. The root cause, pinned on the real door ─────────────────────────────────────────────────

describe('D62b root cause: the SYSTEM flow of operations 95+96 spends two tests and the spacing bucket refuses the second', () => {
  it('a re-verification attempted WITHOUT moving the clock is refused 429 CONNECTION_TEST_RATE_LIMITED before anything is sent', async () => {
    const w = world();
    const candidateId = seedCandidate(w.store, w.nowMs);
    // A `wait` that waits nowhere: the pre-D62b shape - the steps run back to back on one instant.
    const flow = w.connect.systemFlow(ACCOUNT, { wait: async () => undefined });
    const tested = await flow.testCandidate(candidateId);
    expect(tested.outcome).toBe(CaptureConnectionOutcome.REACHABLE);
    expect(w.testerCalls).toEqual([{ host: HOST, credential: true }]);
    const failure = await failureOf(flow.adoptCandidate(candidateId));
    expect(failure.statusCode).toBe(429);
    expect(failure.code).toBe(ApiErrorCode.RATE_LIMITED);
    // The word the bench's single warn line lacked (D62b): WHICH refusal this is.
    expect(failure.details?.['reason']).toBe(CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED);
    // Refused BEFORE a request: the re-verification never reached the device.
    expect(w.testerCalls).toHaveLength(1);
  });
});

// ── A. The fix: the door obeys the limiter's own ask ───────────────────────────────────────────

describe('D62b fix: the paced SYSTEM flow rides its own spacing out and one sweep attaches', () => {
  it('test, wait the limiter ask, re-verify, adopt, assign: ONE sweep, both tests really sent, no failure line', async () => {
    const w = world();
    const flow = w.connect.systemFlow(ACCOUNT, {
      wait: async (ms) => {
        w.waits.push(ms);
        w.advance(ms);
      },
    });
    const attach: SegmentAttach = {
      testCandidate: async (candidateId) => (await flow.testCandidate(candidateId)).outcome,
      adoptCandidate: async (candidateId) => (await flow.adoptCandidate(candidateId)).deviceId,
      assignFirstEmptyTrack: async () => ({ assigned: true, trackId: 'VIDEO-01', reason: null }),
    };
    const logs: { level: 'info' | 'warn'; fields: Record<string, unknown>; message: string }[] = [];
    const options: SegmentSweepOptions = {
      segmentCidr: SEGMENT,
      now: () => w.nowMs,
      listNeighbours: async () => [{ ip: HOST, mac: '00:11:22:33:44:55' }],
      probeAddress: async () => ({ onvif: true, rtsp: false }),
      ownAddresses: () => ['192.0.2.5'],
      registeredAddresses: async () => [],
      store: w.store,
      nextSearchId: () => autoSearchIdOf(w.nowMs, 1),
      audit: async (entry) => void w.audit.push(entry),
      log: {
        info: (fields, message) => logs.push({ level: 'info', fields, message }),
        warn: (fields, message) => logs.push({ level: 'warn', fields, message }),
      },
      openSession: () => null,
      duringRecordingEnabled: false,
      attach,
    };
    const result = await createSegmentSweeper(options).sweep();
    expect(result).toMatchObject({ ran: true, probed: 1, found: 1, carried: 0, adopted: ['CAM-03'] });
    // Both halves of the attach really ran: the ONVIF responder saw the test and the re-verification.
    expect(w.testerCalls).toEqual([
      { host: HOST, credential: true },
      { host: HOST, credential: true },
    ]);
    // Exactly one wait, and it is the limiter's own ask: the contract spacing, within the pacing cap.
    expect(w.waits).toHaveLength(1);
    expect(w.waits[0]).toBeGreaterThan(4_000);
    expect(w.waits[0]).toBeLessThanOrEqual(AUTOATTACH_TEST_PACING_CAP_MS);
    // The story of the sweep in the audit trail: two test rows, the adoption, the credential.
    expect(w.audit.filter((entry) => entry.type === 'CAPTURE_CONNECTION_TESTED')).toHaveLength(2);
    expect(w.audit.some((entry) => entry.type === 'CAPTURE_CANDIDATE_ADOPTED')).toBe(true);
    expect(w.audit.some((entry) => entry.type === 'CAPTURE_CREDENTIAL_SET')).toBe(true);
    expect(logs.some((entry) => entry.level === 'warn' && entry.fields.code === 'CAPTURE_AUTOATTACH_FAILED')).toBe(false);
    expect(logs.some((entry) => entry.fields.code === 'CAPTURE_AUTOATTACH_ASSIGNED')).toBe(true);
    // The candidate reads REGISTERED with its device.
    expect(w.store.stateOf(SYSTEM_OWNER_SESSION_ID, w.nowMs).candidates[0]?.status).toBe('REGISTERED');
  });

  it('a refusal ABOVE the pacing cap (the per-minute bucket) is not waited out inside the step: it surfaces with its reason word for the sweep to log', async () => {
    // The contract's `maxPerMinute` is 6 tests. Three attaches spend six (test + re-verification each,
    // every gap waited out at ≤ the spacing ask); the fourth attach's test would be the seventh inside
    // the minute - the limiter asks ~35 s, over the cap, and the door refuses HONESTLY instead of parking the sweep.
    const w = world();
    const hosts = ['192.0.2.11', '192.0.2.12', '192.0.2.13', '192.0.2.14'];
    w.store.begin({ sessionId: SYSTEM_OWNER_SESSION_ID, searchId: autoSearchIdOf(w.nowMs, 1), trigger: CaptureDiscoveryTrigger.AUTO, startedAt: w.nowMs, windowMs: 0, interfaceCount: 1 });
    w.store.complete(autoSearchIdOf(w.nowMs, 1), hosts.map((ip) => foundOfProbe(ip, { onvif: true, rtsp: false })), { responderCount: 4, interfaceCount: 1, truncated: false, completedAt: w.nowMs });
    const ids = w.store.stateOf(SYSTEM_OWNER_SESSION_ID, w.nowMs).candidates.map((candidate) => candidate.candidateId);
    expect(ids).toHaveLength(4);
    const flow = w.connect.systemFlow(ACCOUNT, {
      wait: async (ms) => {
        expect(ms).toBeLessThanOrEqual(AUTOATTACH_TEST_PACING_CAP_MS); // the door never parks longer than the cap
        w.waits.push(ms);
        w.advance(ms);
      },
    });
    for (const candidateId of ids.slice(0, 3)) {
      expect((await flow.testCandidate(candidateId)).outcome).toBe(CaptureConnectionOutcome.REACHABLE);
      expect((await flow.adoptCandidate(candidateId)).deviceId).toMatch(/^CAM-/);
    }
    const failure = await failureOf(flow.testCandidate(ids[3] as string));
    expect(failure.statusCode).toBe(429);
    expect(failure.details?.['reason']).toBe(CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED);
    // Six tests sent. Every wait was at most the cap: the door first rides out the SPACING ask (5 s, under the cap),
    // and only then the flow itself refuses on the per-minute bucket - an ask of ~30 s, over the cap, so it is NOT
    // waited out: the seventh test never left the Core and the refusal surfaces with its reason word for the sweep.
    expect(w.testerCalls).toHaveLength(6);
    expect(w.waits).toHaveLength(6);
  });
});

// ── B. The retry over the attach boundary ──────────────────────────────────────────────────────

interface SweepHarness {
  readonly options: Mutable<SegmentSweepOptions>;
  readonly logs: { level: 'info' | 'warn'; fields: Record<string, unknown>; message: string }[];
  readonly store: CandidateStore;
  readonly probed: string[];
  setNow(at: number): void;
}

function sweepHarness(attach: SegmentAttach | undefined): SweepHarness {
  const store = createCandidateStore({ randomBytes: counterBytes() });
  let nowMs = T0;
  const logs: SweepHarness['logs'] = [];
  const probed: string[] = [];
  const options: Mutable<SegmentSweepOptions> = {
    segmentCidr: SEGMENT,
    now: () => nowMs,
    listNeighbours: async () => [{ ip: HOST, mac: '00:11:22:33:44:55' }],
    probeAddress: async (ip) => {
      probed.push(ip);
      return { onvif: true, rtsp: false };
    },
    ownAddresses: () => ['192.0.2.5'],
    registeredAddresses: async () => [],
    store,
    nextSearchId: () => autoSearchIdOf(nowMs, probed.length + 1),
    audit: async () => undefined,
    log: {
      info: (fields, message) => logs.push({ level: 'info', fields, message }),
      warn: (fields, message) => logs.push({ level: 'warn', fields, message }),
    },
    openSession: () => null,
    duringRecordingEnabled: false,
    ...(attach === undefined ? {} : { attach }),
    windowMs: 0,
  };
  return { options, logs, store, probed, setNow: (at) => { nowMs = at; } };
}

/** An attach boundary that fails every attempt the way the bench did: a refusal with a reason word. */
function failingAttach(): SegmentAttach & { tested: number } {
  const spy = {
    tested: 0,
    async testCandidate(_candidateId: string) {
      spy.tested += 1;
      throw Object.assign(new Error('Too many connection tests.'), { code: ApiErrorCode.RATE_LIMITED, details: { reason: CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED } });
    },
    async adoptCandidate() {
      throw new Error('unreachable');
    },
    async assignFirstEmptyTrack() {
      return { assigned: false as const, trackId: null, reason: 'REFUSED' as const };
    },
  };
  return spy;
}

describe('D62b retry: an unadopted SEGMENT candidate is re-attempted on later sweeps without re-probing its host', () => {
  it('the failed attach is retried every sweep (carried, re-minted), the host is probed ONCE, and the warn line says the refusal reason word', async () => {
    const spy = failingAttach();
    const h = sweepHarness(spy);
    const sweeper = createSegmentSweeper(h.options);
    const first = await sweeper.sweep();
    expect(first).toMatchObject({ ran: true, probed: 1, found: 1, carried: 0, adopted: [] });
    expect(spy.tested).toBe(1);
    // The bench defect (B): the line that said only `RATE_LIMITED` now carries the reason word too.
    const failed = h.logs.filter((entry) => entry.fields.code === 'CAPTURE_AUTOATTACH_FAILED');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.fields.failureCode).toBe(ApiErrorCode.RATE_LIMITED);
    expect(failed[0]?.fields.refusalReason).toBe(CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED);
    // The next sweep: the host is NOT probed again (the dedupe stands) but the candidate IS carried and re-attempted.
    h.setNow(T0 + 60_000);
    const second = await sweeper.sweep();
    expect(second).toMatchObject({ ran: true, probed: 0, found: 0, carried: 1, adopted: [] });
    expect(h.probed).toEqual([HOST]);
    expect(spy.tested).toBe(2);
    // And again: the carried row is re-minted by the store, so the ids differ while the retry continues.
    h.setNow(T0 + 120_000);
    expect(await sweeper.sweep()).toMatchObject({ carried: 1 });
    expect(spy.tested).toBe(3);
  });

  it('at the cap of five attempts the sweep gives up until the entry expires: no more attempts, no probing, then a fresh sweep may find it again', async () => {
    const spy = failingAttach();
    const h = sweepHarness(spy);
    const sweeper = createSegmentSweeper(h.options);
    for (let sweep = 0; sweep < AUTOATTACH_MAX_ATTACH_ATTEMPTS; sweep += 1) {
      h.setNow(T0 + sweep * 60_000);
      await sweeper.sweep();
    }
    expect(spy.tested).toBe(AUTOATTACH_MAX_ATTACH_ATTEMPTS);
    expect(h.logs.some((entry) => entry.level === 'warn' && entry.fields.code === 'CAPTURE_AUTOATTACH_GIVE_UP' && entry.fields.attempts === AUTOATTACH_MAX_ATTACH_ATTEMPTS)).toBe(true);
    // Given up: the candidate left the list, the host is parked - no probe, no carry, no attempt.
    h.setNow(T0 + 5 * 60_000);
    const parked = await sweeper.sweep();
    expect(parked).toMatchObject({ ran: true, probed: 0, found: 0, carried: 0, adopted: [] });
    expect(spy.tested).toBe(AUTOATTACH_MAX_ATTACH_ATTEMPTS);
    // Past the TTL of a candidate: the parking lifts and the host may be found and attempted afresh.
    h.setNow(T0 + 5 * 60_000 + CAPTURE_DISCOVERY_RESULT_TTL_MS + 1);
    const revived = await sweeper.sweep();
    expect(revived).toMatchObject({ ran: true, probed: 1, found: 1 });
    expect(spy.tested).toBe(AUTOATTACH_MAX_ATTACH_ATTEMPTS + 1);
  });

  it('a candidate whose attach SUCCEEDED is never carried or re-attempted, and a NOT_REACHABLE test spends an attempt like a throw does', async () => {
    const done: SegmentAttach & { tested: number } = {
      tested: 0,
      async testCandidate() {
        done.tested += 1;
        return CaptureConnectionOutcome.UNREACHABLE;
      },
      async adoptCandidate() {
        throw new Error('must not run');
      },
      async assignFirstEmptyTrack() {
        return { assigned: false as const, trackId: null, reason: 'REFUSED' as const };
      },
    };
    const h = sweepHarness(done);
    const sweeper = createSegmentSweeper(h.options);
    await sweeper.sweep();
    h.setNow(T0 + 60_000);
    expect(await sweeper.sweep()).toMatchObject({ probed: 0, carried: 1 });
    expect(done.tested).toBe(2);
    // A succeeding attach: adopted once, and the next sweep carries nothing.
    let tested = 0;
    const ok: SegmentAttach = {
      testCandidate: async () => {
        tested += 1;
        return CaptureConnectionOutcome.REACHABLE;
      },
      adoptCandidate: async () => 'CAM-09',
      assignFirstEmptyTrack: async () => ({ assigned: true, trackId: 'VIDEO-01', reason: null }),
    };
    const h2 = sweepHarness(ok);
    const sweeper2 = createSegmentSweeper(h2.options);
    expect((await sweeper2.sweep()).adopted).toEqual(['CAM-09']);
    h2.setNow(T0 + 60_000);
    expect(await sweeper2.sweep()).toMatchObject({ probed: 0, carried: 0, adopted: [] });
    expect(tested).toBe(1);
  });

  it('WITHOUT the bench pair nothing is carried: the list replaces exactly as it did before D62b', async () => {
    const h = sweepHarness(undefined);
    const sweeper = createSegmentSweeper(h.options);
    expect(await sweeper.sweep()).toMatchObject({ found: 1, carried: 0 });
    h.setNow(T0 + 60_000);
    // The old shape stands with no attach configured: the live list dedupes the probe, and the next sweep re-probes after the replace.
    expect(await sweeper.sweep()).toMatchObject({ probed: 0, found: 0, carried: 0 });
    h.setNow(T0 + 120_000);
    expect(await sweeper.sweep()).toMatchObject({ probed: 1, found: 1, carried: 0 });
  });
});

// ── C. Row 103 (audit 2026-11-05; DF-26; decision D23 (3)): the hardening of the default credential ─────
//
// The bench pair is KEPT (D23 (3), principal ruling D62); what stands here is its hardening: (1) it is never in a
// log line, an error-log row or an audit row - wherever it is printed it reads as the redaction mark; (2) it is spent
// only on a candidate INSIDE `DEMS_CAMERA_SEGMENT_CIDR` that answered as ONVIF - held by the sweep (no attempt) and
// again by the `systemFlow` door (refused before anything is sent); (3) the retry cap is pinned at five.

const OUTSIDE = '198.51.100.7';

/** Lists ONE hand-made row in the SYSTEM store, as a sweep would; returns its candidate id. */
function seedFound(store: CandidateStore, at: number, found: ReturnType<typeof foundOfProbe>): string {
  store.begin({ sessionId: SYSTEM_OWNER_SESSION_ID, searchId: autoSearchIdOf(at, 2), trigger: CaptureDiscoveryTrigger.AUTO, startedAt: at, windowMs: 0, interfaceCount: 1 });
  store.complete(autoSearchIdOf(at, 2), [found], { responderCount: 1, interfaceCount: 1, truncated: false, completedAt: at });
  const candidate = store.stateOf(SYSTEM_OWNER_SESSION_ID, at).candidates[0];
  if (candidate === undefined) throw new Error('the seed left no candidate');
  return candidate.candidateId;
}

describe('row 103 (DF-26, D23 (3)): the default camera credential is never logged, is spent only inside the segment on ONVIF, and its retry cap is pinned', () => {
  it('the retry cap is pinned: five attach attempts per host, no more', () => {
    expect(AUTOATTACH_MAX_ATTACH_ATTEMPTS).toBe(5);
  });

  it('the pair reads as the redaction mark wherever it is printed: the configured Secret as [redacted], the sealed pair as [credential]', () => {
    const secret = new Secret(ACCOUNT.secret);
    for (const printed of [String(secret), JSON.stringify(secret), inspect(secret), JSON.stringify({ secret })]) {
      expect(printed).toContain('[redacted]');
      expect(printed).not.toContain(ACCOUNT.secret);
    }
    const sealed = sealCredential(ACCOUNT);
    for (const printed of [String(sealed), JSON.stringify(sealed), inspect(sealed), JSON.stringify({ sealed })]) {
      expect(printed).toContain(CREDENTIAL_MARK);
      expect(printed).not.toContain(ACCOUNT.secret);
      expect(printed).not.toContain(ACCOUNT.username);
    }
  });

  it('a whole sweep over the REAL door - one adoption, one refused attach - leaves the pair in no log line, no error-log row and no audit row', async () => {
    const w = world();
    const refusing = '192.0.2.118';
    w.connect.replaceForTest({
      tester: {
        test: async (camera: CameraCandidate, credential: SealedCredential | null) => {
          w.testerCalls.push({ host: camera.host, credential: credential !== null });
          if (camera.host === refusing) throw new Error('the device refused the session');
          return { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: credential !== null, usableProfiles: ['main'], rejectedCredentialRequests: 0 };
        },
      },
    });
    const flow = w.connect.systemFlow(ACCOUNT, { wait: async (ms) => void w.advance(ms) });
    const logs: { fields: Record<string, unknown>; message: string }[] = [];
    const sweeper = createSegmentSweeper({
      segmentCidr: SEGMENT,
      now: () => w.nowMs,
      listNeighbours: async () => [{ ip: HOST, mac: '00:11:22:33:44:55' }, { ip: refusing, mac: '00:11:22:33:44:66' }],
      probeAddress: async () => ({ onvif: true, rtsp: true }),
      ownAddresses: () => ['192.0.2.5'],
      registeredAddresses: async () => [],
      store: w.store,
      nextSearchId: () => autoSearchIdOf(w.nowMs, 1),
      audit: async (entry) => void w.audit.push(entry),
      log: { info: (fields, message) => void logs.push({ fields, message }), warn: (fields, message) => void logs.push({ fields, message }) },
      openSession: () => null,
      duringRecordingEnabled: false,
      attach: {
        testCandidate: async (candidateId) => (await flow.testCandidate(candidateId)).outcome,
        adoptCandidate: async (candidateId) => (await flow.adoptCandidate(candidateId)).deviceId,
        assignFirstEmptyTrack: async () => ({ assigned: true, trackId: 'VIDEO-01', reason: null }),
      },
    });
    const result = await sweeper.sweep();
    expect(result.adopted).toHaveLength(1);
    expect(logs.some((entry) => entry.fields.code === 'CAPTURE_AUTOATTACH_FAILED' || entry.fields.code === 'CAPTURE_AUTOATTACH_NOT_REACHABLE')).toBe(true);
    expect(w.audit.some((entry) => entry.type === 'CAPTURE_CREDENTIAL_SET')).toBe(true);
    // Every line and row, as a log transport would write it (JSON) and as an inspection would print it.
    const lines = [...logs, ...w.lines];
    const printedLines = [JSON.stringify(lines), inspect(lines, { depth: 8 })].join('\n');
    expect(printedLines).not.toContain(ACCOUNT.secret);
    expect(printedLines).not.toContain(ACCOUNT.username);
    const printedRows = [JSON.stringify(w.audit), inspect(w.audit, { depth: 8 })].join('\n');
    expect(printedRows).not.toContain(ACCOUNT.secret);
  });

  it('the sweep never attempts a candidate outside the configured /24: no attempt spent, never carried, the warn line names the candidate id only', async () => {
    const tested: string[] = [];
    const h = sweepHarness({
      async testCandidate(candidateId: string) {
        tested.push(candidateId);
        return CaptureConnectionOutcome.UNREACHABLE;
      },
      async adoptCandidate() {
        throw new Error('must not run');
      },
      async assignFirstEmptyTrack() {
        return { assigned: false as const, trackId: null, reason: 'REFUSED' as const };
      },
    });
    // A neighbour list that is NOT filtered to the segment (production's `listNeighboursOver` filters; this seam does not).
    h.options.listNeighbours = async () => [{ ip: HOST, mac: '00:11:22:33:44:55' }, { ip: OUTSIDE, mac: '00:11:22:33:44:77' }];
    const sweeper = createSegmentSweeper(h.options);
    const first = await sweeper.sweep();
    expect(first).toMatchObject({ ran: true, probed: 2, found: 2 });
    const hostOf = (id: string) => h.store.stateOf(SYSTEM_OWNER_SESSION_ID, T0).candidates.find((candidate) => candidate.candidateId === id)?.host;
    expect(tested.map(hostOf)).toEqual([HOST]);
    const scoped = h.logs.filter((entry) => entry.fields.code === 'CAPTURE_AUTOATTACH_OUT_OF_SCOPE');
    expect(scoped).toHaveLength(1);
    expect(Object.keys(scoped[0]?.fields ?? {}).sort()).toEqual(['candidateId', 'code', 'source']);
    expect(JSON.stringify(scoped)).not.toContain(OUTSIDE);
    // The next sweep carries the in-scope host only: the outside one is never carried for a retry.
    h.setNow(T0 + 60_000);
    expect(await sweeper.sweep()).toMatchObject({ carried: 1 });
    expect(tested).toHaveLength(2);
  });

  it('a segment text that is not the strict /24 attaches nothing at all', async () => {
    let tested = 0;
    const h = sweepHarness({
      async testCandidate() {
        tested += 1;
        return CaptureConnectionOutcome.REACHABLE;
      },
      async adoptCandidate() {
        return 'CAM-09';
      },
      async assignFirstEmptyTrack() {
        return { assigned: false as const, trackId: null, reason: 'REFUSED' as const };
      },
    });
    h.options.segmentCidr = '192.0.2.0/23';
    expect(await createSegmentSweeper(h.options).sweep()).toMatchObject({ ran: true, found: 1, adopted: [] });
    expect(tested).toBe(0);
  });

  it('the systemFlow door refuses BEFORE anything is sent: a host outside the segment, a service address outside it, a non-ONVIF answer, no segment configured', async () => {
    const refusedAtDoor = async (w: AttachWorld, candidateId: string): Promise<void> => {
      const flow = w.connect.systemFlow(ACCOUNT, { wait: async () => undefined });
      for (const step of [() => flow.testCandidate(candidateId), () => flow.adoptCandidate(candidateId)]) {
        const failure = await failureOf(step());
        expect(failure.statusCode).toBe(409);
        expect(failure.code).toBe(ApiErrorCode.INVALID_STATE);
        expect(failure.details?.['reason']).toBe(CaptureDiscoveryReason.CANDIDATE_NOT_TESTABLE);
        expect(JSON.stringify({ message: failure.message, details: failure.details })).not.toContain(ACCOUNT.secret);
      }
      expect(w.testerCalls).toEqual([]);
    };
    // A host outside DEMS_CAMERA_SEGMENT_CIDR.
    const outside = world();
    await refusedAtDoor(outside, seedFound(outside.store, outside.nowMs, foundOfProbe(OUTSIDE, { onvif: true, rtsp: false })));
    // A host inside whose service address points outside.
    const steered = world();
    const inside = foundOfProbe(HOST, { onvif: true, rtsp: false });
    const away = `http://${OUTSIDE}:80/onvif/device_service`;
    await refusedAtDoor(steered, seedFound(steered.store, steered.nowMs, { ...inside, connectionTarget: away, camera: { ...inside.camera, serviceAddress: away } }));
    // An answer inside that is not ONVIF.
    const notOnvif = world();
    await refusedAtDoor(notOnvif, seedFound(notOnvif.store, notOnvif.nowMs, { ...inside, adapter: 'LOCAL_DEVICE', camera: { ...inside.camera, adapterKind: 'LOCAL_DEVICE' } }));
    // No segment configured: every candidate is refused.
    const unset = world(null);
    await refusedAtDoor(unset, seedCandidate(unset.store, unset.nowMs));
    // And the in-scope candidate of the same world shape IS tested (the guard is not a blanket refusal).
    const ok = world();
    const flow = ok.connect.systemFlow(ACCOUNT, { wait: async () => undefined });
    expect((await flow.testCandidate(seedCandidate(ok.store, ok.nowMs))).outcome).toBe(CaptureConnectionOutcome.REACHABLE);
    expect(ok.testerCalls).toEqual([{ host: HOST, credential: true }]);
  });
});
