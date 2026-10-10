// Fix wave I, driver A1 - re-gate 75 finding G75b-01 (ruling D216), the seal side.
//
// WHY FIVE FAILED ATTEMPTS ENDED "BLOCKED" AND NOT IN THE TERMINAL PATH. `SEALER_FAILED` is one of
// the RETRIABLE codes, and a retriable cause is never terminal (way-out.ts: three retries, then the
// wait for a start). That is right for a key store that may come back; it was wrong for a key of
// ANOTHER session under this session's ID, which no retry gets past. After the fix that one cause
// is not retriable: bounded attempts, then UNSEALABLE - journal closed, recordings MOVED to the
// quarantine, the session ended, the Core free. Run against the real pipeline on generated
// recordings, as `way-out.test.ts`.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { SEAL_BLOCKED_DETAILS } from '@dems/shared/sim';
import { SEALING_QUARANTINE_DIR, SEALING_UNSEALABLE_CODE, SEAL_RETRY_DEFAULTS, SealerCause, SealingError, createSealWayOut, sealBlockedNotice, sealBlockedRestoreHint, sealWayOutOf, sealingCauseCodeOf, sealingFailureReason, type SealOutcome, type SealWayOut } from '../index';
import { removePackages } from './package-support';
import { harnessOf, recordSession, removeRecordings, type Harness, type Recording } from './pipeline-support';

afterAll(() => {
  removeRecordings();
  removePackages();
});

type Blocked = { readonly sessionId: string; readonly cause: string; readonly step: string; readonly message: string; readonly detail?: string };

function rigOf(recording: Recording) {
  const h: Harness = harnessOf(recording);
  const outcomes: SealOutcome[] = [];
  const ended: { sessionId: string; cause: string; quarantinedFiles: number }[] = [];
  const blocked: Blocked[] = [];
  const running = new Set<Promise<unknown>>();
  const run = async (): Promise<SealOutcome> => {
    const outcome = await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    outcomes.push(outcome);
    await wayOut.after(outcome);
    return outcome;
  };
  const wayOut: SealWayOut = createSealWayOut({
    settings: () => SEAL_RETRY_DEFAULTS,
    timer: h.clock.timer,
    journal: h.journal,
    now: h.clock.now,
    log: h.log,
    retry: () => {
      const under = run();
      running.add(under);
      void under.finally(() => running.delete(under));
      return under;
    },
    tell: (input) => h.ports.engine.applySealingProgress(input),
    end: async (input) => void ended.push({ ...input }),
    packageDir: h.ports.packageDir,
    stagingDir: h.ports.stagingDir,
    quarantineDir: h.ports.quarantineDir,
    blocked: async (input) => void blocked.push({ ...input }),
    unblocked: async () => {},
  });
  return {
    h,
    outcomes,
    ended,
    blocked,
    wayOut,
    first: async () => void (await run()),
    async advance(ms: number) {
      h.clock.advance(ms);
      for (let turn = 0; turn < 50; turn += 1) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (running.size === 0) break;
        await Promise.allSettled(running);
      }
    },
    told: () => h.engine.progress.at(-1)?.steps.find((step) => step.status === 'FAILED')?.detail ?? null,
  };
}

/** The sealer of a Core whose key store refuses with that code: what `session-key.ts` throws, by its `code`. */
const sealerThatThrows = (h: Harness, code: string): void => {
  Object.assign(h.ports, {
    sealer: {
      seal() {
        throw Object.assign(new Error('the store refused'), { code });
      },
    },
  });
};

const failed = (detail: Record<string, string>, attempt: number, retriable: boolean) => ({ status: 'FAILED', sessionId: 'SES-20261010-0025', attempt, step: 'CLOSE_TRACKS', code: 'SEALER_FAILED', retriable, detail }) as Extract<SealOutcome, { status: 'FAILED' }>;

describe('G75b-01: the rule', () => {
  it('a key of another session is NOT retriable: retried up to the bound, then TERMINAL - named by its cause, not by the step that failed', () => {
    const error = new SealingError('SEALER_FAILED', 'x', { trackId: 'VIDEO-01', seq: 1, cause: SealerCause.SESSION_KEY_NOT_OF_SESSION });
    expect(error.retriable).toBe(false);
    const detail = { cause: 'SESSION_KEY_NOT_OF_SESSION' };
    expect(sealWayOutOf(failed(detail, 1, false), 0, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'RETRY', delayMs: 5_000, retry: 1, of: 3 });
    expect(sealWayOutOf(failed(detail, 2, false), 1, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'RETRY', delayMs: 30_000, retry: 2, of: 3 });
    expect(sealWayOutOf(failed(detail, 3, false), 2, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'TERMINAL', cause: 'SESSION_KEY_NOT_OF_SESSION' });
    // The attempts are the journal's: the session of re-gate 75 (attempt 9 after two starts) is terminal at its next run.
    expect(sealWayOutOf(failed(detail, 9, false), 0, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'TERMINAL', cause: 'SESSION_KEY_NOT_OF_SESSION' });
  });

  it('BEFORE THE FIX (control): the same failure classed retriable is never terminal - WAIT at attempts 4, 5, 9: the blocked lane of re-gate 75', () => {
    const detail = { cause: 'SESSION_KEY_NOT_OF_SESSION' };
    expect(sealWayOutOf(failed(detail, 4, true), 3, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'WAIT' });
    expect(sealWayOutOf(failed(detail, 9, true), 3, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'WAIT' });
  });

  it('a key store that is unreachable STAYS retriable and is never terminal (control: a key that may come back must not cost a recording)', () => {
    expect(new SealingError('SEALER_FAILED', 'x', { cause: SealerCause.SESSION_KEY_STORE_UNAVAILABLE }).retriable).toBe(true);
    expect(new SealingError('SEALER_FAILED', 'x', {}).retriable).toBe(true);
    expect(sealWayOutOf(failed({ cause: 'SESSION_KEY_STORE_UNAVAILABLE' }, 40, true), 3, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'WAIT' });
  });

  it('what an operator reads: a sentence and a restore hint per cause; the blocked notice of every cause fits the alert (400 characters) and names no path and no key file', () => {
    expect(Object.values(SealerCause).sort()).toEqual([...SEAL_BLOCKED_DETAILS].sort());
    const sentences = new Set<string>();
    for (const cause of [...Object.values(SealerCause), undefined]) {
      const detail: Record<string, string> = cause === undefined ? {} : { cause };
      const notice = sealBlockedNotice('SEALER_FAILED', detail);
      sentences.add(sealingFailureReason('SEALER_FAILED', detail));
      expect(notice.length).toBeLessThanOrEqual(400);
      expect(notice).toMatch(/^Sealing of this session is blocked\. /);
      expect(notice).not.toMatch(/\/|\\|KID-|\.key\b|\.blob\b/);
      expect(sealingCauseCodeOf('SEALER_FAILED', detail)).toBe(cause ?? 'SEALER_FAILED');
    }
    // Every cause has its own sentence; without a cause the sentence is the one of before.
    expect(sentences.size).toBe(Object.values(SealerCause).length + 1);
    expect(sealingFailureReason('SEALER_FAILED')).toBe('The session key could not be used: the seal stopped and can be tried again.');
    // A key that was never MADE is not "restored": the hint follows the cause.
    expect(sealBlockedRestoreHint('SEALER_FAILED', { cause: 'SESSION_KEY_STORE_UNAVAILABLE' })).toMatch(/^Check the Core's key store/);
    expect(sealBlockedRestoreHint('SEALER_FAILED')).toMatch(/^Restore the session key/);
    expect(sealBlockedRestoreHint('FRAGMENT_NOT_OPENABLE')).toMatch(/^Restore the session key/);
    // A word that is no cause of this list changes nothing (never free text into a sentence).
    expect(sealingFailureReason('SEALER_FAILED', { cause: '/etc/passwd' })).toBe(sealingFailureReason('SEALER_FAILED'));
  });
});

describe('G75b-01: the outcome, on the real pipeline', () => {
  it('a key of another session: three attempts, then UNSEALABLE - the journal is closed, BOTH recordings are MOVED to the quarantine (none deleted), the session is ended ONCE with the cause, and no blocked alert is raised', async () => {
    const recording = recordSession();
    const rig = rigOf(recording);
    sealerThatThrows(rig.h, 'CREDENTIAL_SESSION_KEY_NOT_OF_SESSION');
    await rig.first();
    expect(rig.outcomes[0]).toMatchObject({ status: 'FAILED', step: 'CLOSE_TRACKS', code: 'SEALER_FAILED', retriable: false, attempt: 1, detail: { cause: 'SESSION_KEY_NOT_OF_SESSION' } });
    expect(rig.told()).toBe(`Sealing is being retried (retry 1 of 3, in 5 s). ${sealingFailureReason('SEALER_FAILED', { cause: 'SESSION_KEY_NOT_OF_SESSION' })}`);
    // The error log names the cause as a code beside the step.
    expect(rig.h.log.entries.find((entry) => entry.message === 'a sealing step failed')).toMatchObject({ code: 'SEALER_FAILED', context: { step: 'CLOSE_TRACKS', cause: 'SESSION_KEY_NOT_OF_SESSION' } });
    await rig.advance(5_000);
    await rig.advance(30_000);
    expect(rig.outcomes.map((outcome) => (outcome as { attempt?: number }).attempt)).toEqual([1, 2, 3]);
    // TERMINAL at the third attempt: no fourth run, however long the Core stays up.
    await rig.advance(600_000);
    expect(rig.outcomes).toHaveLength(3);
    expect(rig.wayOut.pending()).toBeNull();
    expect(rig.ended).toEqual([{ sessionId: recording.sessionId, cause: 'SESSION_KEY_NOT_OF_SESSION', quarantinedFiles: expect.any(Number) as number }]);
    expect(rig.ended[0]?.quarantinedFiles).toBeGreaterThanOrEqual(2);
    expect(rig.blocked).toEqual([]);
    expect(rig.h.journal.rows.get(`${recording.sessionId}#CLOSE_TRACKS`)).toMatchObject({ status: 'FAILED', errorCode: SEALING_UNSEALABLE_CODE, checkpoint: { unsealable: { cause: 'SESSION_KEY_NOT_OF_SESSION' } } });
    const quarantine = join(recording.mediaDir, SEALING_QUARANTINE_DIR, recording.sessionId);
    expect(readdirSync(quarantine)).toEqual(expect.arrayContaining(['VIDEO-01.mp4', 'VIDEO-02.mp4']));
    expect(existsSync(rig.h.ports.packageDir(recording.sessionId))).toBe(false);
  });

  it('CONTROL - a key store that is unreachable: retried three times, then BLOCKED with the cause as `detail`; the session is NOT ended and nothing is moved', async () => {
    const recording = recordSession();
    const rig = rigOf(recording);
    sealerThatThrows(rig.h, 'CREDENTIAL_STORE_UNAVAILABLE');
    await rig.first();
    await rig.advance(5_000);
    await rig.advance(30_000);
    await rig.advance(120_000);
    expect(rig.outcomes).toHaveLength(4);
    expect(rig.outcomes[3]).toMatchObject({ status: 'FAILED', code: 'SEALER_FAILED', retriable: true, detail: { cause: 'SESSION_KEY_STORE_UNAVAILABLE' } });
    expect(rig.ended).toEqual([]);
    expect(rig.blocked).toEqual([{ sessionId: recording.sessionId, cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS', detail: 'SESSION_KEY_STORE_UNAVAILABLE', message: sealBlockedNotice('SEALER_FAILED', { cause: 'SESSION_KEY_STORE_UNAVAILABLE' }) }]);
    expect(rig.h.log.entries.find((entry) => entry.code === 'SEALING_SESSION_BLOCKED')).toMatchObject({ context: { failure: 'SEALER_FAILED', cause: 'SESSION_KEY_STORE_UNAVAILABLE', step: 'CLOSE_TRACKS' } });
    expect(existsSync(join(recording.mediaDir, SEALING_QUARANTINE_DIR, recording.sessionId))).toBe(false);
    expect(existsSync(join(rig.h.ports.packageDir(recording.sessionId), 'VIDEO-01.mp4'))).toBe(true);
  });

  it('a sealer that throws a value without a known code: the failure carries NO cause and reads as before (control)', async () => {
    const recording = recordSession();
    const rig = rigOf(recording);
    Object.assign(rig.h.ports, {
      sealer: {
        seal() {
          throw new Error('/secret/path/KID-X.key could not be read');
        },
      },
    });
    await rig.first();
    expect(rig.outcomes[0]).toMatchObject({ status: 'FAILED', code: 'SEALER_FAILED', retriable: true });
    expect((rig.outcomes[0] as { detail: Record<string, unknown> }).detail).not.toHaveProperty('cause');
    expect(rig.told()).not.toContain('/secret');
  });
});
