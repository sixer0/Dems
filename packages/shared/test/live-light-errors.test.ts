// Plan row W18, HB-15: the error classes of a Live action (04_client_integration_spec §2.5 CL-20,
// CL-21; research/03_analysis.md ADQ-3 rule 1). The simulator's classes keep their identity, so an
// existing `instanceof` branch needs no change; two classes are new and extend none of them.
import { describe, expect, it } from 'vitest';
import * as live from '../src/live';
import { CoreRefusalError, LiveTransportError, LiveTransportReason, settle } from '../src/live';
import * as sim from '../src/sim';
import { simErrorCode, SimNotFoundError, SimPermissionError, SimTransitionError } from '../src/sim';

describe('class identity (ADQ-3 rule 1, CL-20)', () => {
  it('the three simulator classes taken from the Live module are the simulator\'s own class objects', () => {
    expect(live.SimPermissionError).toBe(sim.SimPermissionError);
    expect(live.SimTransitionError).toBe(sim.SimTransitionError);
    expect(live.SimNotFoundError).toBe(sim.SimNotFoundError);
  });

  it('an error built through the Live module satisfies an instanceof written against the simulator module, and the reverse', () => {
    expect(new live.SimPermissionError('archiveEvidence', 'EVIDENCE_REVIEW')).toBeInstanceOf(sim.SimPermissionError);
    expect(new live.SimTransitionError('RECORDING', 'restart', undefined, 'RECORDING_ACTIVE')).toBeInstanceOf(sim.SimTransitionError);
    expect(new live.SimNotFoundError('evidence', 'EV-404')).toBeInstanceOf(sim.SimNotFoundError);
    expect(new sim.SimPermissionError('archiveEvidence', 'EVIDENCE_REVIEW')).toBeInstanceOf(live.SimPermissionError);
  });

  it('a rejected Live result reaches fail as the same object, so its class, code and fields survive', async () => {
    const refusal = new SimPermissionError('archiveEvidence', 'EVIDENCE_REVIEW', 'NOT_PERMITTED');
    const seen: unknown[] = [];
    const rejected = Promise.reject(refusal);
    settle(() => rejected, { fail: (error) => seen.push(error) });
    await rejected.catch(() => undefined);
    expect(seen[0]).toBe(refusal);
    expect(seen[0]).toBeInstanceOf(sim.SimPermissionError);
    expect(simErrorCode(seen[0])).toBe('NOT_PERMITTED');
    expect((seen[0] as SimPermissionError).permission).toBe('EVIDENCE_REVIEW');
  });
});

describe('LiveTransportError (CL-21, CL-22)', () => {
  it('has the two reasons of the mobile sign-in contract', () => {
    expect(Object.values(LiveTransportReason).sort()).toEqual(['CORE_OFFLINE', 'UNAVAILABLE']);
  });

  it('carries the reason; every detail defaults to null', () => {
    const error = new LiveTransportError('CORE_OFFLINE');
    expect(error.reason).toBe('CORE_OFFLINE');
    expect(error.name).toBe('LiveTransportError');
    expect([error.status, error.code, error.retryAfterSeconds, error.requestId]).toEqual([null, null, null, null]);
    expect(error.message).toContain('CORE_OFFLINE');
    expect(error.stack).toBeTypeOf('string');
  });

  it('keeps the status and the retry-after value, so a 429 can be worded as a limit (LB-10)', () => {
    const limited = new LiveTransportError(LiveTransportReason.UNAVAILABLE, {
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: 37,
      requestId: 'req-0001',
    });
    expect(limited).toMatchObject({ reason: 'UNAVAILABLE', status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 37, requestId: 'req-0001' });
    expect(limited.message).toContain('UNAVAILABLE');
  });

  it('tells a time-out from a server that is starting and from a command that was never sent (LB-6, LB-7)', () => {
    const timedOut = new LiveTransportError('CORE_OFFLINE', { code: 'TIMEOUT' });
    const starting = new LiveTransportError('CORE_OFFLINE', { status: 503, code: 'NOT_READY' });
    const notSent = new LiveTransportError('CORE_OFFLINE');
    expect([timedOut.code, timedOut.status]).toEqual(['TIMEOUT', null]);
    expect([starting.code, starting.status]).toEqual(['NOT_READY', 503]);
    expect([notSent.code, notSent.status]).toEqual([null, null]);
  });

  it('never puts a detail into the message: the text is fixed per reason', () => {
    const marker = 'MARKER-7f3a';
    const error = new LiveTransportError('UNAVAILABLE', { code: marker, requestId: marker });
    expect(error.message).not.toContain(marker);
  });
});

describe('CoreRefusalError (CL-21)', () => {
  it('carries the envelope code; the details default to null', () => {
    const error = new CoreRefusalError('DEMO_DISABLED');
    expect(error.code).toBe('DEMO_DISABLED');
    expect(error.name).toBe('CoreRefusalError');
    expect([error.status, error.requestId]).toEqual([null, null]);
    expect(error.message).toContain('DEMO_DISABLED');
  });

  it('keeps the status and the request ID of the answer', () => {
    expect(new CoreRefusalError('LAST_ADMIN', { status: 409, requestId: 'req-0002' })).toMatchObject({ code: 'LAST_ADMIN', status: 409, requestId: 'req-0002' });
  });

  it('serves the client-side refusal of an action without an operation (NOT_AVAILABLE)', () => {
    expect(new CoreRefusalError('NOT_AVAILABLE').code).toBe('NOT_AVAILABLE');
  });
});

describe('the two new classes beside the existing branches', () => {
  const transport = new LiveTransportError('CORE_OFFLINE');
  const refusal = new CoreRefusalError('LAST_ADMIN', { status: 409 });

  it('are Errors, and are no simulator class: an existing branch does not take them by mistake', () => {
    for (const error of [transport, refusal]) {
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(SimPermissionError);
      expect(error).not.toBeInstanceOf(SimTransitionError);
      expect(error).not.toBeInstanceOf(SimNotFoundError);
      expect(simErrorCode(error)).toBeNull();
    }
    expect(transport).not.toBeInstanceOf(CoreRefusalError);
    expect(refusal).not.toBeInstanceOf(LiveTransportError);
  });

  it('a fail branch written as today (permission, transition, else generic) keeps its meaning, and gains two branches', () => {
    /** The branch order of the web command wrapper (`use-sim-command.ts`), with the two Live branches added. */
    const branchOf = (error: unknown): string => {
      if (error instanceof SimPermissionError) return `denied:${error.permission}`;
      if (error instanceof SimTransitionError) return `transition:${error.code}`;
      if (error instanceof LiveTransportError) return error.status === 429 ? `limit:${error.retryAfterSeconds}` : `transport:${error.reason}`;
      if (error instanceof CoreRefusalError) return `refused:${error.code}`;
      return 'generic';
    };
    const outcomes: string[] = [];
    const thrown: unknown[] = [
      new SimPermissionError('deviceCommand', 'DEVICE_MANAGE'),
      new SimTransitionError('RECORDING', 'restart', undefined, 'RECORDING_ACTIVE'),
      transport,
      new LiveTransportError('UNAVAILABLE', { status: 429, retryAfterSeconds: 12 }),
      refusal,
      new Error('anything else'),
    ];
    for (const error of thrown) {
      settle(
        () => {
          throw error;
        },
        { fail: (received) => outcomes.push(branchOf(received)) },
      );
    }
    expect(outcomes).toEqual(['denied:DEVICE_MANAGE', 'transition:RECORDING_ACTIVE', 'transport:CORE_OFFLINE', 'limit:12', 'refused:LAST_ADMIN', 'generic']);
  });
});
