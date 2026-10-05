// Plan row W18, HB-15: typed access to the Core's actions (04_client_integration_spec §2.5 CL-12;
// §12.1 TS-2; AC-C-06, identity part). `coreActionsOf(sim)` is `sim.actions` itself for a simulator:
// no wrapper, no promise, no added microtask. The hook `useCoreActions()` is tested in
// live-light-hooks.test.ts.
//
// The type assertions are checked by `npm run typecheck` (tsc includes this folder).
import { describe, expect, expectTypeOf, it } from 'vitest';
import { coreActionsOf, type CoreActions, type CoreResult } from '../src/live';
import {
  createManualClock,
  createSim,
  DEMO_OPERATOR_PASSWORD,
  selectIsSignedIn,
  type AuditExportRequest,
  type ChainVerifyResult,
  type CreateSessionResult,
  type ExportResult,
  type PairResult,
  type SessionCreateInput,
  type SignInResult,
  type Sim,
  type SimActions,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function simulator(): Sim {
  return createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario: 'idle' });
}

describe('coreActionsOf on a simulator (AC-C-06, identity part)', () => {
  it('returns sim.actions itself: the same object, on every call', () => {
    const sim = simulator();
    expect(coreActionsOf(sim)).toBe(sim.actions);
    expect(coreActionsOf(sim)).toBe(coreActionsOf(sim));
  });

  it('adds no wrapper: every member is the very function of sim.actions', () => {
    const sim = simulator();
    const actions = coreActionsOf(sim);
    const names = Object.keys(sim.actions) as (keyof SimActions)[];
    expect(names.length).toBeGreaterThanOrEqual(42);
    for (const name of names) expect(actions[name]).toBe(sim.actions[name]);
    expect(Object.keys(actions)).toEqual(names);
  });

  it('returns plain values, never a promise: a result union, a string, a number and undefined', () => {
    const sim = simulator();
    const actions = coreActionsOf(sim);
    const signedIn = actions.signIn('rina.wijaya', DEMO_OPERATOR_PASSWORD);
    const runId = actions.runDiagnostics();
    const restarted = actions.restartServices();
    const nothing = actions.touch();
    for (const value of [signedIn, runId, restarted, nothing]) {
      expect(value).not.toBeInstanceOf(Promise);
      expect(typeof (value as { then?: unknown } | undefined)?.then).toBe('undefined');
    }
    expect(signedIn).toMatchObject({ ok: true, role: 'TECHNICIAN' });
    expect(typeof runId).toBe('string');
    expect(typeof restarted).toBe('number');
    expect(nothing).toBeUndefined();
  });

  it('adds no microtask: the effect is in the store when the call returns', () => {
    const sim = simulator();
    expect(selectIsSignedIn(sim.store.getState())).toBe(false);
    coreActionsOf(sim).signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(selectIsSignedIn(sim.store.getState())).toBe(true);
  });
});

describe('CoreActions: the type', () => {
  it('has exactly the members of SimActions', () => {
    expectTypeOf<keyof CoreActions>().toEqualTypeOf<keyof SimActions>();
  });

  it('keeps every parameter list', () => {
    expectTypeOf<CoreActions['signIn']>().parameters.toEqualTypeOf<[username: string, password: string]>();
    expectTypeOf<CoreActions['createSession']>().parameters.toEqualTypeOf<[input: SessionCreateInput]>();
    expectTypeOf<CoreActions['exportAudit']>().parameters.toEqualTypeOf<[request?: AuditExportRequest]>();
    expectTypeOf<CoreActions['stopRecording']>().parameters.toEqualTypeOf<[reason: string]>();
    expectTypeOf<CoreActions['touch']>().parameters.toEqualTypeOf<[]>();
    type SameParameters = {
      [Name in keyof SimActions]: Parameters<CoreActions[Name]> extends Parameters<SimActions[Name]>
        ? Parameters<SimActions[Name]> extends Parameters<CoreActions[Name]>
          ? true
          : false
        : false;
    };
    expectTypeOf<SameParameters[keyof SimActions]>().toEqualTypeOf<true>();
  });

  it('widens every return type R to R | Promise<R>', () => {
    expectTypeOf<CoreActions['signIn']>().returns.toEqualTypeOf<SignInResult | Promise<SignInResult>>();
    expectTypeOf<CoreActions['createSession']>().returns.toEqualTypeOf<CoreResult<CreateSessionResult>>();
    expectTypeOf<CoreActions['pair']>().returns.toEqualTypeOf<CoreResult<PairResult>>();
    expectTypeOf<CoreActions['exportEvidence']>().returns.toEqualTypeOf<CoreResult<ExportResult>>();
    expectTypeOf<CoreActions['verifyAuditChain']>().returns.toEqualTypeOf<CoreResult<ChainVerifyResult>>();
    expectTypeOf<CoreActions['scanCaseNumber']>().returns.toEqualTypeOf<string | Promise<string>>();
    expectTypeOf<CoreActions['restartServices']>().returns.toEqualTypeOf<number | Promise<number>>();
    expectTypeOf<CoreActions['snapshot']>().returns.toEqualTypeOf<void | Promise<void>>();
    type Widened = {
      [Name in keyof SimActions]: ReturnType<CoreActions[Name]> extends CoreResult<ReturnType<SimActions[Name]>>
        ? CoreResult<ReturnType<SimActions[Name]>> extends ReturnType<CoreActions[Name]>
          ? true
          : false
        : false;
    };
    expectTypeOf<Widened[keyof SimActions]>().toEqualTypeOf<true>();
  });

  it('accepts the simulator actions and a fully asynchronous Live set alike', () => {
    expectTypeOf<SimActions>().toExtend<CoreActions>();
    type LiveActions = { [Name in keyof SimActions]: (...args: Parameters<SimActions[Name]>) => Promise<ReturnType<SimActions[Name]>> };
    expectTypeOf<LiveActions>().toExtend<CoreActions>();
    // The widened type is not the simulator's: a call site cannot read a result without settling it.
    expectTypeOf<CoreActions>().not.toExtend<SimActions>();
  });

  it('coreActionsOf takes a Sim and returns CoreActions', () => {
    expectTypeOf(coreActionsOf).parameters.toEqualTypeOf<[sim: Sim]>();
    expectTypeOf(coreActionsOf).returns.toEqualTypeOf<CoreActions>();
  });
});
