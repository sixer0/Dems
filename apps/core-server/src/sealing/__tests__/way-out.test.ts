// Fix pass F-M7b (review row 88, R88-02 (a) + (c); rulings D178 (2), D183): EVERY SEAL FAILURE HAS A
// WAY OUT. Run against the real pipeline on generated recordings, a journal in memory and a clock
// the test moves:
//
//   (a) a RETRIABLE failure is tried again in the running process after a bounded back-off, and the
//       operator is told "Sealing is being retried" with the cause;
//   (c) NOTHING SEALABLE, or a cause no retry gets past at its bound, is TERMINAL: the journal is
//       marked, every remaining file of the session is MOVED to the quarantine (owner-only, never
//       deleted), and the engine is asked ONCE to end the session as UNSEALABLE.
//
// Evidence integrity: each exit has its control; the mutation proof of (c) is in the note of this
// pass (the bound switched off: the session stays FINALIZING for ever and case "at the bound" is red).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { SEALING_QUARANTINE_DIR, SEALING_STEP_ORDER, SEALING_UNSEALABLE_CODE, SEAL_RETRY_DEFAULTS, createSealWayOut, sealBlockedNotice, sealBlockedRestoreHint, sealWayOutOf, sealingFailureReason, type SealOutcome, type SealRetrySettings, type SealWayOut } from '../index';
import { removePackages } from './package-support';
import { harnessOf, recordSession, removeRecordings, sha256Hex, type Harness, type Recording } from './pipeline-support';

afterAll(() => {
  removeRecordings();
  removePackages();
});

interface Rig {
  readonly h: Harness;
  readonly wayOut: SealWayOut;
  readonly outcomes: SealOutcome[];
  readonly ended: { sessionId: string; cause: string; quarantinedFiles: number }[];
  /** F-M7c (ruling D186 (1)): what the engine was told of a seal that is blocked, in order. */
  readonly blocked: ({ readonly kind: 'RAISED'; readonly sessionId: string; readonly cause: string; readonly step: string; readonly message: string } | { readonly kind: 'RESOLVED'; readonly sessionId: string })[];
  /** Makes the engine door fail once (the Core's engine is not running). */
  failEnd: boolean;
  /** The first run, as the hand-off starts it; its outcome goes through the way out like every later one. */
  first(): Promise<void>;
  /** Moves the clock and lets every retry that became due finish. */
  advance(ms: number): Promise<void>;
  told(): string | null;
}

function rigOf(recording: Recording, settings: SealRetrySettings = SEAL_RETRY_DEFAULTS): Rig {
  const h = harnessOf(recording);
  const outcomes: SealOutcome[] = [];
  const ended: Rig['ended'] = [];
  const blocked: Rig['blocked'] = [];
  const running = new Set<Promise<unknown>>();
  const run = async (): Promise<SealOutcome | null> => {
    const outcome = await h.again().run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    outcomes.push(outcome);
    // What the controller's `onOutcome` does in the composition.
    await rig.wayOut.after(outcome);
    return outcome;
  };
  const rig: Rig = {
    h,
    outcomes,
    ended,
    blocked,
    failEnd: false,
    wayOut: createSealWayOut({
      settings: () => settings,
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
      end: async (input) => {
        if (rig.failEnd) {
          rig.failEnd = false;
          throw new Error('the engine is not running');
        }
        ended.push({ ...input });
      },
      packageDir: h.ports.packageDir,
      stagingDir: h.ports.stagingDir,
      quarantineDir: h.ports.quarantineDir,
      blocked: async (input) => void blocked.push({ kind: 'RAISED', ...input }),
      unblocked: async (sessionId) => void blocked.push({ kind: 'RESOLVED', sessionId }),
    }),
    first: async () => void (await run()),
    async advance(ms) {
      h.clock.advance(ms);
      for (let turn = 0; turn < 50; turn += 1) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (running.size === 0) break;
        await Promise.allSettled(running);
      }
    },
    told: () => h.engine.progress.at(-1)?.steps.find((step) => step.status === 'FAILED')?.detail ?? null,
  };
  return rig;
}

const quarantineOf = (recording: Recording): string => join(recording.mediaDir, SEALING_QUARANTINE_DIR, recording.sessionId);
const rowOf = (h: Harness, step: string) => h.journal.rows.get(`${h.recording.sessionId}#${step}`);
const nothingSealable = (recording: Recording): void => {
  for (const trackId of ['VIDEO-01', 'VIDEO-02'] as const) {
    const row = recording.tracks[trackId].rows[0]!;
    recording.tracks[trackId].rows[0] = { ...row, sha256: sha256Hex(Buffer.from(`not ${trackId}`)) };
  }
};
/** A retriable failure at FINALIZE_HASHES: the Core holds no session key. `heal` puts it back. */
function withoutSessionKey(h: Harness): { heal(): void } {
  const opener = h.ports.opener;
  Object.assign(h.ports, { opener: null });
  return { heal: () => void Object.assign(h.ports, { opener }) };
}

describe('the rule: what follows a failed seal (named settings, defaults stated)', () => {
  const failed = (code: string, retriable: boolean, attempt: number) => ({ status: 'FAILED', sessionId: 'SES-20261010-0001', attempt, step: 'CLOSE_TRACKS', code, retriable, detail: {} }) as Extract<SealOutcome, { status: 'FAILED' }>;

  it('the defaults: three retries after 5 s, 30 s and 120 s; a cause no retry gets past is terminal at its third attempt', () => {
    expect(SEAL_RETRY_DEFAULTS).toEqual({ delaysMs: [5_000, 30_000, 120_000], nonRecoverableAttempts: 3 });
  });

  it('a retriable failure: RETRY with the delay of its turn, then WAIT for the next start - never terminal', () => {
    expect(sealWayOutOf(failed('STORAGE_FAILED', true, 1), 0, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'RETRY', delayMs: 5_000, retry: 1, of: 3 });
    expect(sealWayOutOf(failed('STORAGE_FAILED', true, 3), 2, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'RETRY', delayMs: 120_000, retry: 3, of: 3 });
    expect(sealWayOutOf(failed('STORAGE_FAILED', true, 4), 3, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'WAIT' });
    expect(sealWayOutOf(failed('SIGNER_FAILED', true, 40), 3, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'WAIT' });
  });

  it('NOTHING_SEALABLE is terminal at once; another cause no retry gets past is retried up to its bound, then terminal', () => {
    expect(sealWayOutOf(failed('NOTHING_SEALABLE', false, 1), 0, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'TERMINAL', cause: 'NOTHING_SEALABLE' });
    expect(sealWayOutOf(failed('PACKAGE_NOT_CLEAN', false, 1), 0, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'RETRY', delayMs: 5_000, retry: 1, of: 3 });
    expect(sealWayOutOf(failed('PACKAGE_NOT_CLEAN', false, 2), 1, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'RETRY', delayMs: 30_000, retry: 2, of: 3 });
    expect(sealWayOutOf(failed('PACKAGE_NOT_CLEAN', false, 3), 2, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'TERMINAL', cause: 'PACKAGE_NOT_CLEAN' });
    // The attempts are the journal's: a Core that restarts between them reaches the bound all the same.
    expect(sealWayOutOf(failed('MANIFEST_INVALID', false, 3), 0, SEAL_RETRY_DEFAULTS)).toEqual({ action: 'TERMINAL', cause: 'MANIFEST_INVALID' });
  });
});

describe('(a) a RETRIABLE failure is retried in the running process, with a bounded back-off', () => {
  it('the cause goes away: the retry seals; the operator read "Sealing is being retried" with the cause; nothing is quarantined', async () => {
    const recording = recordSession();
    const rig = rigOf(recording);
    const key = withoutSessionKey(rig.h);
    await rig.first();
    expect(rig.outcomes[0]).toMatchObject({ status: 'FAILED', code: 'FRAGMENT_NOT_OPENABLE', retriable: true, attempt: 1 });
    expect(rig.told()).toBe(`Sealing is being retried (retry 1 of 3, in 5 s). ${sealingFailureReason('FRAGMENT_NOT_OPENABLE')}`);
    expect(rig.wayOut.pending()).toBe(recording.sessionId);

    key.heal();
    // CONTROL: before the delay has passed nothing runs.
    await rig.advance(4_999);
    expect(rig.outcomes).toHaveLength(1);
    await rig.advance(1);
    expect(rig.outcomes).toHaveLength(2);
    expect(rig.outcomes[1]).toMatchObject({ status: 'SEALED', attempt: 2 });
    expect(rig.wayOut.pending()).toBeNull();
    expect(rig.ended).toEqual([]);
    expect(existsSync(quarantineOf(recording))).toBe(false);
  });

  it('the cause stays: three retries after 5 s, 30 s, 120 s, then the seal WAITS for the next start - the session is NOT ended and nothing is moved (control of (c))', async () => {
    const recording = recordSession();
    const rig = rigOf(recording);
    withoutSessionKey(rig.h);
    await rig.first();
    await rig.advance(5_000);
    expect(rig.outcomes).toHaveLength(2);
    expect(rig.told()).toBe(`Sealing is being retried (retry 2 of 3, in 30 s). ${sealingFailureReason('FRAGMENT_NOT_OPENABLE')}`);
    await rig.advance(30_000);
    expect(rig.told()).toBe(`Sealing is being retried (retry 3 of 3, in 120 s). ${sealingFailureReason('FRAGMENT_NOT_OPENABLE')}`);
    await rig.advance(120_000);
    expect(rig.outcomes.map((outcome) => [outcome.status, (outcome as { attempt?: number }).attempt])).toEqual([
      ['FAILED', 1],
      ['FAILED', 2],
      ['FAILED', 3],
      ['FAILED', 4],
    ]);
    expect(rig.told()).toBe(`${sealingFailureReason('FRAGMENT_NOT_OPENABLE')} Sealing will be tried again when the Core starts, or by the recovery action.`);
    expect(rig.wayOut.pending()).toBeNull();
    // BOUNDED: no fifth run however long the Core stays up.
    await rig.advance(3_600_000);
    expect(rig.outcomes).toHaveLength(4);
    expect(rig.ended).toEqual([]);
    expect(existsSync(quarantineOf(recording))).toBe(false);
    for (const trackId of ['VIDEO-01', 'VIDEO-02'] as const) expect(existsSync(recording.recordingFile(trackId))).toBe(true);
    // ON DEMAND (the recovery operation): the count starts again and the seal runs at once.
    rig.wayOut.reset(recording.sessionId);
    expect(sealWayOutOf(rig.outcomes[3] as Extract<SealOutcome, { status: 'FAILED' }>, 0, SEAL_RETRY_DEFAULTS).action).toBe('RETRY');
  });
});

describe('(c) the TERMINAL outcome: the session is ended UNSEALABLE and its files are in the quarantine', () => {
  it('NOTHING_SEALABLE: at once - the journal is marked, every recording is MOVED (byte for byte, owner-only), the engine is asked ONCE', async () => {
    const recording = recordSession();
    nothingSealable(recording);
    const before = Object.fromEntries((['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => [trackId, readFileSync(recording.recordingFile(trackId))]));
    const rig = rigOf(recording);
    await rig.first();
    expect(rig.outcomes).toHaveLength(1);
    expect(rig.outcomes[0]).toMatchObject({ status: 'FAILED', code: 'NOTHING_SEALABLE' });
    expect(rig.ended).toEqual([{ sessionId: recording.sessionId, cause: 'NOTHING_SEALABLE', quarantinedFiles: 2 }]);
    const home = quarantineOf(recording);
    for (const trackId of ['VIDEO-01', 'VIDEO-02'] as const) {
      expect(readFileSync(join(home, `${trackId}.mp4`)).equals(before[trackId]!)).toBe(true);
      expect(statSync(join(home, `${trackId}.mp4`)).mode & 0o777).toBe(0o600);
    }
    expect(statSync(home).mode & 0o777).toBe(0o700);
    expect(statSync(join(home, '..')).mode & 0o777).toBe(0o700);
    // Nothing of the session is left in its folder: the folder itself is gone (it was empty).
    expect(existsSync(recording.packageDir)).toBe(false);
    // THE JOURNAL IS CLOSED: the row of the failed step says UNSEALABLE with the cause; no start runs this seal again.
    expect(rowOf(rig.h, 'CLOSE_TRACKS')).toMatchObject({ status: 'FAILED', errorCode: SEALING_UNSEALABLE_CODE, checkpoint: { unsealable: { cause: 'NOTHING_SEALABLE' } } });
    expect(rig.wayOut.pending()).toBeNull();
    expect(rig.h.log.entries.filter((entry) => entry.code === 'SEALING_SESSION_UNSEALABLE')).toHaveLength(1);
    await rig.advance(3_600_000);
    expect(rig.outcomes).toHaveLength(1);
    expect(rig.ended).toHaveLength(1);
  });

  it('a cause no retry gets past: retried, and AT THE BOUND the session is ended - it never stays FINALIZING for ever (mutation proof)', async () => {
    const recording = recordSession();
    const rig = rigOf(recording);
    // A file the package does not declare: STORE_SEALED_PACKAGE refuses to commit (PACKAGE_NOT_CLEAN, not retriable).
    writeFileSync(join(recording.packageDir, 'stray.bin'), 'not of the package');
    await rig.first();
    expect(rig.outcomes[0]).toMatchObject({ status: 'FAILED', step: 'STORE_SEALED_PACKAGE', code: 'PACKAGE_NOT_CLEAN', retriable: false, attempt: 1 });
    // CONTROL: below the bound the session is NOT ended; it is being retried and says so.
    expect(rig.ended).toEqual([]);
    expect(rig.told()).toBe(`Sealing is being retried (retry 1 of 3, in 5 s). ${sealingFailureReason('PACKAGE_NOT_CLEAN')}`);
    await rig.advance(5_000);
    expect(rig.outcomes).toHaveLength(2);
    expect(rig.ended).toEqual([]);
    await rig.advance(30_000);
    // THE BOUND (third attempt): terminal.
    expect(rig.outcomes).toHaveLength(3);
    expect(rig.outcomes[2]).toMatchObject({ status: 'FAILED', code: 'PACKAGE_NOT_CLEAN', attempt: 3 });
    expect(rig.ended).toHaveLength(1);
    expect(rig.ended[0]).toMatchObject({ sessionId: recording.sessionId, cause: 'PACKAGE_NOT_CLEAN' });
    expect(rowOf(rig.h, 'STORE_SEALED_PACKAGE')).toMatchObject({ status: 'FAILED', errorCode: SEALING_UNSEALABLE_CODE });
    // EVERYTHING the session folder held is in the quarantine - the recordings, the sealed files that were never committed, the stray file.
    const home = quarantineOf(recording);
    expect(readdirSync(home).sort()).toEqual(expect.arrayContaining(['VIDEO-01.mp4', 'VIDEO-02.mp4', 'fragments', 'stray.bin']));
    expect(existsSync(recording.packageDir)).toBe(false);
    expect(rig.h.engine.sealed).toHaveLength(0);
    await rig.advance(3_600_000);
    expect(rig.outcomes).toHaveLength(3);
  });

  it('the engine could not be told (or the Core died after the move): the mark stays, and the next start FINISHES the terminal outcome without running the seal', async () => {
    const recording = recordSession();
    nothingSealable(recording);
    const rig = rigOf(recording);
    rig.failEnd = true;
    await rig.first();
    expect(rig.ended).toEqual([]);
    expect(rowOf(rig.h, 'CLOSE_TRACKS')).toMatchObject({ errorCode: SEALING_UNSEALABLE_CODE });
    expect(existsSync(join(quarantineOf(recording), 'VIDEO-01.mp4'))).toBe(true);
    expect(rig.h.log.entries.some((entry) => entry.code === 'SEALING_UNSEALABLE_NOT_FINISHED' && entry.level === 'error')).toBe(true);
    // The next start: the pending terminal outcome is finished; no pipeline run.
    expect(await rig.wayOut.finishPending(recording.sessionId)).toBe(true);
    expect(rig.ended).toEqual([{ sessionId: recording.sessionId, cause: 'NOTHING_SEALABLE', quarantinedFiles: 0 }]);
    expect(rig.outcomes).toHaveLength(1);
    // Nothing was overwritten or lost by the second pass.
    // (`fragments` is the empty folder CLOSE_TRACKS made before it found that nothing validates.)
    expect(readdirSync(quarantineOf(recording)).sort()).toEqual(['VIDEO-01.mp4', 'VIDEO-02.mp4', 'fragments']);
  });

  it('CONTROL: a session whose journal is not marked has no pending terminal outcome, and a SEALED outcome starts nothing', async () => {
    const recording = recordSession();
    const rig = rigOf(recording);
    await rig.first();
    expect(rig.outcomes[0]?.status).toBe('SEALED');
    expect(await rig.wayOut.finishPending(recording.sessionId)).toBe(false);
    expect(rig.ended).toEqual([]);
    expect(rig.wayOut.pending()).toBeNull();
    expect(existsSync(quarantineOf(recording))).toBe(false);
    expect(SEALING_STEP_ORDER.map((step) => rowOf(rig.h, step)?.status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE', 'DONE', 'DONE']);
  });
});

describe('RULING D186 (1): a retriable cause that never goes away keeps the session FINALIZING - and that is VISIBLE (fix pass F-M7c)', () => {
  it('after the retries of the process are used up the engine is told ONCE: the cause, the step and what restores it; the retries before it tell nothing', async () => {
    const recording = recordSession();
    const rig = rigOf(recording);
    withoutSessionKey(rig.h);
    await rig.first();
    await rig.advance(5_000);
    await rig.advance(30_000);
    // CONTROL: while a retry is still to come nobody is alarmed.
    expect(rig.blocked).toEqual([]);
    await rig.advance(120_000);
    expect(rig.outcomes).toHaveLength(4);
    expect(rig.blocked).toEqual([{ kind: 'RAISED', sessionId: recording.sessionId, cause: 'FRAGMENT_NOT_OPENABLE', step: 'FINALIZE_HASHES', message: sealBlockedNotice('FRAGMENT_NOT_OPENABLE') }]);
    expect(rig.blocked[0]).toMatchObject({ message: expect.stringContaining('session key') });
    expect(sealBlockedNotice('FRAGMENT_NOT_OPENABLE')).toContain(sealBlockedRestoreHint('FRAGMENT_NOT_OPENABLE'));
    expect(sealBlockedNotice('FRAGMENT_NOT_OPENABLE')).toContain('The Core records no new session until this one is sealed.');
    // The persistent log says the same, with the cause.
    expect(rig.h.log.entries.filter((entry) => entry.code === 'SEALING_SESSION_BLOCKED').map((entry) => [entry.level, entry.context?.failure, entry.context?.restore])).toEqual([['error', 'FRAGMENT_NOT_OPENABLE', sealBlockedRestoreHint('FRAGMENT_NOT_OPENABLE')]]);
    // The session is NOT ended and nothing is moved: the evidence is intact.
    expect(rig.ended).toEqual([]);
  });

  it('the cause goes away and the seal completes (on demand): the notice is RESOLVED, once', async () => {
    const recording = recordSession();
    const rig = rigOf(recording);
    const key = withoutSessionKey(rig.h);
    await rig.first();
    await rig.advance(5_000);
    await rig.advance(30_000);
    await rig.advance(120_000);
    expect(rig.blocked.map((entry) => entry.kind)).toEqual(['RAISED']);
    key.heal();
    rig.wayOut.reset(recording.sessionId);
    await rig.first();
    expect(rig.outcomes.at(-1)?.status).toBe('SEALED');
    expect(rig.blocked.map((entry) => entry.kind)).toEqual(['RAISED', 'RESOLVED']);
  });

  it('CONTROL: a seal that completes at the first run, and one that heals on a retry, raise nothing', async () => {
    const clean = rigOf(recordSession());
    await clean.first();
    expect(clean.outcomes.at(-1)?.status).toBe('SEALED');
    expect(clean.blocked.filter((entry) => entry.kind === 'RAISED')).toEqual([]);
    const healing = rigOf(recordSession());
    const key = withoutSessionKey(healing.h);
    await healing.first();
    key.heal();
    await healing.advance(5_000);
    expect(healing.outcomes.at(-1)?.status).toBe('SEALED');
    expect(healing.blocked.filter((entry) => entry.kind === 'RAISED')).toEqual([]);
  });

  it('every retriable cause has a sentence that says what restores it', () => {
    for (const code of ['STORAGE_FAILED', 'SIGNER_FAILED', 'ENGINE_REFUSED', 'JOURNAL_FAILED', 'FRAGMENT_NOT_OPENABLE', 'SEALER_FAILED', 'TRANSCRIPT_STEP_FAILED'] as const) {
      expect(sealBlockedRestoreHint(code).length, code).toBeGreaterThan(20);
      expect(sealBlockedRestoreHint(code), code).not.toBe(sealBlockedRestoreHint('STEP_FAILED'));
    }
  });
});

// Fix pass F-M7c (item 3 (i); F-M7b's decision 6, ruling D186): the transcriber scratch of an UNSEALABLE session - its raw
// audio tap - goes to the quarantine WITH the recordings: it is evidence the Core could not seal, never left behind, never deleted.
describe('the transcriber scratch of an UNSEALABLE session moves to its quarantine folder', () => {
  it('NOTHING_SEALABLE with a scratch folder: the tap is in `<quarantine>/transcriber/`, byte for byte, owner-only, and the scratch folder is gone', async () => {
    const recording = recordSession();
    nothingSealable(recording);
    const scratch = join(recording.mediaDir, '.transcriber', 'sessions', recording.sessionId);
    mkdirSync(join(scratch, 'work'), { recursive: true });
    writeFileSync(join(scratch, 'tap.pcm'), 'raw session audio');
    writeFileSync(join(scratch, 'work', 'chunk-1.wav'), 'audio');
    const h = harnessOf(recording);
    const ended: unknown[] = [];
    const released: string[] = [];
    const wayOut = createSealWayOut({ settings: () => SEAL_RETRY_DEFAULTS, timer: h.clock.timer, journal: h.journal, now: h.clock.now, log: h.log, retry: async () => null, tell: (input) => h.ports.engine.applySealingProgress(input), end: async (input) => void ended.push(input), packageDir: h.ports.packageDir, stagingDir: h.ports.stagingDir, quarantineDir: h.ports.quarantineDir, scratchDir: (sessionId) => (released.push(sessionId), scratch) });
    const outcome = await h.pipeline.run({ sessionId: recording.sessionId, cause: 'STOPPED' });
    expect(await wayOut.after(outcome)).toEqual({ action: 'TERMINAL', cause: 'NOTHING_SEALABLE' });
    const kept = join(quarantineOf(recording), 'transcriber');
    expect(readFileSync(join(kept, 'tap.pcm'), 'utf8')).toBe('raw session audio');
    expect(readFileSync(join(kept, 'work', 'chunk-1.wav'), 'utf8')).toBe('audio');
    expect(statSync(join(kept, 'tap.pcm')).mode & 0o777).toBe(0o600);
    expect(statSync(kept).mode & 0o777).toBe(0o700);
    expect(existsSync(scratch)).toBe(false);
    // The run was released first (the port is asked once, before the move), and the count of moved files includes the scratch.
    expect(released).toEqual([recording.sessionId]);
    expect(ended).toMatchObject([{ sessionId: recording.sessionId, cause: 'NOTHING_SEALABLE', quarantinedFiles: 4 }]);
  });

  it('CONTROL: a session without a scratch folder, and a Core without the port, end as before (the recordings only)', async () => {
    const recording = recordSession();
    nothingSealable(recording);
    const rig = rigOf(recording);
    await rig.first();
    expect(rig.ended).toMatchObject([{ quarantinedFiles: 2 }]);
    expect(existsSync(join(quarantineOf(recording), 'transcriber'))).toBe(false);
  });
});
