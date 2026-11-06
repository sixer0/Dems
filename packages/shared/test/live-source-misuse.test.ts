// Plan row W44, fix round after checkpoint CP-C1: findings CPC1-4 (the row's own F66-10) and CPC1-14.
//
// Under `asSim`, `useSimActions()` hands the Live actions out typed as the simulator's, so a call
// site can read a Live result as a value: `result.ok` is `undefined`, a `try` around a void action
// catches nothing, and by design no rejection raises an event. The static test of the client rows
// (AC-C-53) is one guard; the Live source reports what it can see at run time:
//
// | Sign | Level | Detected | Not detected |
// |------|-------|----------|--------------|
// | READ_AS_VALUE | error | The member `ok` is read on the result of an action that returns a value in the simulator | A read of another member (`exportId`, `length`, a text use of the result) |
// | NOT_OBSERVED | warn | Such a result settled, and `then`, `catch` and `finally` were never called on it | Whether the value was dropped on purpose or misread; an action that returns nothing in the simulator; a handler attached later than the settlement |
import { afterEach, describe, expect, it } from 'vitest';
import { pickReplicatedState, type ReplicatedState } from '../src/api';
import { createCoreClient } from '../src/client';
import { settle } from '../src/live';
import {
  LIVE_BINDING_NAMES,
  LIVE_RESULT_DISCRIMINANT,
  LIVE_VALUE_ACTION_NAMES,
  LiveMisuse,
  asSim,
  createLiveSim,
  operationOf,
  type LiveSim,
} from '../src/live/source';
import { createFakeTransport, type FakeTransport } from '../src/live/testing';
import {
  DEFAULT_SEED,
  DEMO_OPERATOR_PASSWORD,
  buildScenarioState,
  createIdleState,
  createManualClock,
  createSim,
  type Sim,
  type SimErrorReport,
  type SimState,
} from '../src/sim';

let fake: FakeTransport;
let live: LiveSim | undefined;

afterEach(() => {
  live?.stop();
  live = undefined;
  (fake as FakeTransport | undefined)?.assertNoViolations();
});

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);
const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
};

async function signedIn(): Promise<{ source: LiveSim; misuse: () => SimErrorReport[] }> {
  fake = createFakeTransport({ epoch: 3, revision: 40 });
  const recording = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
  fake.scriptSignedInStart(wire(recording));
  fake.answerFromExample(operationOf('verifyAuditChain'));
  fake.answerFromExample(operationOf('touch'));
  const reports: SimErrorReport[] = [];
  const source = createLiveSim({
    client: createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch: fake.fetch }),
    socket: { url: 'ws://127.0.0.1:4420/ws', factory: fake.socketFactory },
    now: fake.clock.now,
    timers: fake.clock.timers,
    onError: (report) => reports.push(report),
  });
  live = source;
  await source.ready;
  fake.connection().beatEvery();
  return { source, misuse: () => reports.filter((report) => report.source === 'live.misuse') };
}

describe('CPC1-4: a Live result that is used as a value is reported (F66-10)', () => {
  it('READ_AS_VALUE: the member `ok` read on the result of a value-returning action is reported at once, as an error, once per action', async () => {
    const { source, misuse } = await signedIn();
    // What a call site does that still has the simulator's type: `const result = actions.verifyAuditChain(); if (result.ok) …`
    const result = asSim(source).actions.verifyAuditChain();
    expect(result.ok).toBeUndefined();
    expect(misuse()).toHaveLength(1);
    expect(misuse()[0]).toMatchObject({
      level: 'error',
      source: 'live.misuse',
      context: { action: 'verifyAuditChain', misuse: LiveMisuse.READ_AS_VALUE, member: LIVE_RESULT_DISCRIMINANT },
    });
    expect(misuse()[0]?.message).toContain('verifyAuditChain');
    expect(misuse()[0]?.message).toContain('settle()');
    // The same call site again, and the same member again: still one report.
    expect(asSim(source).actions.verifyAuditChain().ok).toBeUndefined();
    expect(result.ok).toBeUndefined();
    await flush();
    expect(misuse().filter((report) => report.context?.misuse === LiveMisuse.READ_AS_VALUE)).toHaveLength(1);
    // Another action is another report.
    expect(asSim(source).actions.signInWithSecurityKey().ok).toBeUndefined();
    expect(misuse().filter((report) => report.context?.misuse === LiveMisuse.READ_AS_VALUE).map((report) => report.context?.action)).toEqual(['verifyAuditChain', 'signInWithSecurityKey']);
  });

  it('the watched member is not listed: a log or a matcher that walks the result reads nothing', async () => {
    const { source, misuse } = await signedIn();
    const result = source.actions.verifyAuditChain();
    expect(Object.keys(result)).not.toContain('ok');
    expect(JSON.stringify(result)).toBe('{}');
    await result;
    expect(misuse()).toEqual([]);
  });

  it('NOT_OBSERVED: a value-returning result nobody called then, catch or finally on is reported once it settled, as a warning, once per action', async () => {
    const { source, misuse } = await signedIn();
    void source.actions.verifyAuditChain();
    // Nothing before it settled.
    expect(misuse()).toEqual([]);
    await flush();
    expect(misuse()).toHaveLength(1);
    expect(misuse()[0]).toMatchObject({ level: 'warn', source: 'live.misuse', context: { action: 'verifyAuditChain', misuse: LiveMisuse.NOT_OBSERVED, member: null } });
    void source.actions.verifyAuditChain();
    await flush();
    expect(misuse()).toHaveLength(1);
    // A result that is settled when it is returned (an action that is refused without a request) is watched too.
    void source.actions.signInWithSecurityKey();
    await flush();
    expect(misuse().map((report) => `${String(report.context?.action)} ${String(report.context?.misuse)}`)).toEqual([
      'verifyAuditChain NOT_OBSERVED',
      'signInWithSecurityKey NOT_OBSERVED',
    ]);
  });

  it('no report: await, settle(), then, catch, finally, Promise.all, and a result returned from an async function', async () => {
    const { source, misuse } = await signedIn();
    await source.actions.verifyAuditChain();
    settle(() => source.actions.verifyAuditChain(), { ok: () => undefined, fail: () => undefined });
    void source.actions.verifyAuditChain().then(() => undefined);
    void source.actions.signInWithSecurityKey().catch(() => undefined);
    void source.actions.pair('123456').finally(() => undefined).catch(() => undefined);
    await Promise.all([source.actions.verifyAuditChain(), source.actions.signInWithSecurityKey().catch(() => null)]);
    const viaAsync = async (): Promise<unknown> => source.actions.verifyAuditChain();
    await viaAsync();
    // A result that is already settled when it is awaited.
    await source.actions.pair('123456').catch(() => null);
    await flush();
    expect(misuse()).toEqual([]);
  });

  it('no report for an action that returns nothing in the simulator, however it is called: fire-and-forget is how the shells call them', async () => {
    const { source, misuse } = await signedIn();
    void source.actions.touch();
    void source.actions.setTabletLink('OFFLINE');
    void source.actions.setActiveCamera(source.store.getState().activeCameraId);
    // Not detectable, and stated so: a void result read as a value.
    expect((source.actions.touch() as unknown as { ok?: boolean }).ok).toBeUndefined();
    expect((source.actions.setTabletLink('OFFLINE') as unknown as { ok?: boolean }).ok).toBeUndefined();
    await flush();
    expect(misuse()).toEqual([]);
  });

  it('the names: the 14 actions whose simulator signature returns a value; in a real simulator each result union carries the watched member', () => {
    expect([...LIVE_VALUE_ACTION_NAMES]).toEqual([
      'signIn',
      'signInWithBiometric',
      'recordBiometricFailure',
      'signInWithSecurityKey',
      'createSession',
      'scanCaseNumber',
      'verify',
      'exportEvidence',
      'exportAudit',
      'exportLogs',
      'verifyAuditChain',
      'runDiagnostics',
      'restartServices',
      'pair',
    ]);
    for (const name of LIVE_VALUE_ACTION_NAMES) expect(LIVE_BINDING_NAMES).toContain(name);

    const clock = createManualClock(Date.parse('2026-10-01T10:00:00+07:00'));
    const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'recording', seed: DEFAULT_SEED });
    const unions: Record<string, unknown> = {
      signIn: sim.actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD),
      signInWithSecurityKey: sim.actions.signInWithSecurityKey(),
      recordBiometricFailure: sim.actions.recordBiometricFailure(null),
      createSession: sim.actions.createSession({} as never),
      exportEvidence: sim.actions.exportEvidence('none', { reason: 'Prosecutor review', destination: 'Case file' }),
      exportAudit: sim.actions.exportAudit({ reason: 'Monthly audit review' }),
      exportLogs: sim.actions.exportLogs({ reason: 'Monthly audit review' }),
      verifyAuditChain: sim.actions.verifyAuditChain(),
      pair: sim.actions.pair('000000'),
    };
    for (const [name, value] of Object.entries(unions)) {
      expect(LIVE_VALUE_ACTION_NAMES, name).toContain(name);
      expect(typeof (value as Record<string, unknown>)[LIVE_RESULT_DISCRIMINANT], name).toBe('boolean');
    }
    // And an action outside the list returns nothing there.
    expect(sim.actions.touch()).toBeUndefined();
    expect(sim.actions.setPresentationMode(true)).toBeUndefined();
  });
});

describe('CPC1-14: `asSim` is a checked cast', () => {
  it('a Live source has every member of a real simulator, by name and by kind', async () => {
    const { source } = await signedIn();
    const sim: Sim = createSim({ clock: createManualClock(0), storage: null, authStorage: null, seed: DEFAULT_SEED });
    const names = Object.keys(sim).sort();
    expect(names.length).toBeGreaterThanOrEqual(16);
    for (const name of names) {
      expect(name in source, name).toBe(true);
      expect(typeof (source as unknown as Record<string, unknown>)[name], name).toBe(typeof (sim as unknown as Record<string, unknown>)[name]);
    }
    expect(asSim(source)).toBe(source);
  });

  it('compile time: no member of Sim is missing on LiveSim (this file does not compile otherwise)', () => {
    // The same statement `asSim` makes; `npm run typecheck` checks this line.
    const missing: [Exclude<keyof Sim, keyof LiveSim>] extends [never] ? true : false = true;
    // Every member but the two documented ones is assignable as it is.
    const assignable = (source: LiveSim): Omit<Sim, 'actions' | 'store'> => source;
    expect(missing).toBe(true);
    expect(typeof assignable).toBe('function');
  });
});
