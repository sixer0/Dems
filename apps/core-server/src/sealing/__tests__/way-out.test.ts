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
import { SEALING_QUARANTINE_DIR, SEALING_STEP_ORDER, SEALING_UNSEALABLE_CODE, SEAL_RETRY_DEFAULTS, createSealWayOut, sealBlockedNotice, sealBlockedRestoreHint, sealWayOutOf, sealingFailureReason, type SealOutcome, type SealRetrySettings, type SealWayOut, SealerCause, SealingError, sealingCauseCodeOf, SealingFailure, sealCauseWithoutConclusion, sealRetryingNotice, type SealingDetail, sealClosingNotice, sealWaitingNotice } from '../index';
import { removePackages } from './package-support';
import { harnessOf, recordSession, removeRecordings, sha256Hex, type Harness, type Recording } from './pipeline-support';
import { SEAL_BLOCKED_DETAILS, SEAL_AUTOMATIC_RETRIES, SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_RETRY_CONTROL_NAME, SEAL_RETRY_HOW_SENTENCE, canRetryBlockedSeal, OperatorRole, sealStoppedSentence, type SimState } from '@dems/shared/sim';
import { SEAL_BLOCKED_MESSAGE_MAX, raiseSealBlockedTransition } from '../../engine/sealing-notice-doors';

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
    // Closing pass L-Z (G75d-02; decision 3 of note 155), pin moved by delta: the sentence said "tried again when the Core starts, or by the
    // recovery action" - a name no screen has. It states what the Core did and that it WAITS; the alert names the retry.
    expect(rig.told()).toBe(`${sealingFailureReason('FRAGMENT_NOT_OPENABLE')} Sealing stopped after 3 automatic retries: the Core now waits and does not run it again by itself.`);
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

describe('G75b-01: the way out of a seal blocked by a session key (wave I, driver A1)', () => {
  // Fix wave I, driver A1 - re-gate 75 finding G75b-01 (ruling D216), the seal side.
  //
  // WHY FIVE FAILED ATTEMPTS ENDED "BLOCKED" AND NOT IN THE TERMINAL PATH. `SEALER_FAILED` is one of
  // the RETRIABLE codes, and a retriable cause is never terminal (way-out.ts: three retries, then the
  // wait for a start). That is right for a key store that may come back; it was wrong for a key of
  // ANOTHER session under this session's ID, which no retry gets past. After the fix that one cause
  // is not retriable: bounded attempts, then UNSEALABLE - journal closed, recordings MOVED to the
  // quarantine, the session ended, the Core free. Run against the real pipeline on generated
  // recordings, as `way-out.test.ts`.

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

    it('what an operator reads: a sentence and a restore hint per cause; the blocked notice of every cause fits the alert (the bound of the engine door) and names no path and no key file', () => {
      expect(Object.values(SealerCause).sort()).toEqual([...SEAL_BLOCKED_DETAILS].sort());
      const sentences = new Set<string>();
      for (const cause of [...Object.values(SealerCause), undefined]) {
        const detail: Record<string, string> = cause === undefined ? {} : { cause };
        const notice = sealBlockedNotice('SEALER_FAILED', detail);
        sentences.add(sealingFailureReason('SEALER_FAILED', detail));
        // Closing pass L-Z (G75d-02), bound moved by delta with the engine door's (`SEAL_BLOCKED_MESSAGE_MAX`): the notice names the retry by
        // its screen name, who presses it and where - the longest cause sentences no longer fit 400.
        expect(notice.length).toBeLessThanOrEqual(SEAL_BLOCKED_MESSAGE_MAX);
        expect(SEAL_BLOCKED_MESSAGE_MAX).toBe(600);
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
      // Fix wave L (re-check 75 finding G75d-04; pin moved by delta): while the bounded attempts still run the step says the CAUSE and
      // that it is retried - not, in the same sentence, that "this session cannot be sealed" (true at the terminal end only).
      // CONTROL (the finding): the reason of this cause ends with that conclusion, and the sentence before the fix was the two glued together.
      const reason = sealingFailureReason('SEALER_FAILED', { cause: 'SESSION_KEY_NOT_OF_SESSION' });
      expect(reason).toMatch(/: this session cannot be sealed\.$/);
      expect(rig.told()).not.toBe(`Sealing is being retried (retry 1 of 3, in 5 s). ${reason}`);
      expect(rig.told()).toBe("Sealing is being retried (retry 1 of 3, in 5 s). A session key of an earlier session with this session number is in the Core's key store. A session key is never reused.");
      expect(rig.told()).not.toMatch(/cannot be sealed/i);
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
});

describe('G75d-04 and G75d-02: the retry sentence and the bounded retries (wave L, driver L-S)', () => {
  // Fix wave L, driver L-S - re-check 75 findings G75d-04 (the sentence of a failed step said "is being
  // retried" and "cannot be sealed" at once) and G75d-02 (the bounded retries, as a constant a client
  // may print from).
  //
  // | Rule | Test |
  // |------|------|
  // | Every failure reason that ends "this session cannot be sealed" loses exactly that conclusion in the retry sentence; every other reason is unchanged | 1 |
  // | The retry sentence of a cause that may heal is what it was | 2 |
  // | The shared constant of the automatic retries IS the Core's bound: three, 5 s / 30 s / 120 s, and no fourth | 3 |
  // The sentence on the real pipeline (a key of another session, attempt 1): 'G75b-01: the way out of a seal blocked by a session key', above in this file (pin moved by delta).

  type Failed = Extract<SealOutcome, { status: 'FAILED' }>;
  const failed = (over: Partial<Failed>): Failed => ({ status: 'FAILED', sessionId: 'SES-20261011-0041', attempt: 1, step: 'CLOSE_TRACKS', code: SealingFailure.SEALER_FAILED, retriable: true, detail: {}, ...over }) as Failed;

  describe('G75d-04: the retry sentence states the cause, never the terminal conclusion', () => {
    it('1. every reason that concludes "cannot be sealed" loses the conclusion and keeps the cause; the others are untouched', () => {
      const details: SealingDetail[] = [{}, { trackId: 'VIDEO-02' }, { trackId: 'VIDEO-01', reason: 'NO_FRAGMENT', seq: 3, bytes: 9_000_000, limitBytes: 8_000_000 }, ...Object.values(SealerCause).map((cause) => ({ cause }))];
      let concluded = 0;
      for (const code of Object.values(SealingFailure)) {
        for (const detail of details) {
          const reason = sealingFailureReason(code, detail);
          const cause = sealCauseWithoutConclusion(reason);
          if (/this session cannot be sealed\.$/i.test(reason)) {
            concluded += 1;
            expect(cause).not.toMatch(/cannot be sealed/i);
            expect(cause.endsWith('.')).toBe(true);
            expect(cause.length).toBeGreaterThan(20);
            // Nothing but the conclusion went: the cause is the reason's own beginning.
            expect(reason.startsWith(cause.slice(0, -1))).toBe(true);
          } else {
            expect(cause).toBe(reason);
          }
        }
      }
      // CONTROL: the reasons with that conclusion exist (camera file unusable / missing / mismatch / too large, the key of another session).
      expect(concluded).toBeGreaterThanOrEqual(5);
    });

    it('2. a cause that may heal: the sentence is what it was', () => {
      const reason = sealingFailureReason(SealingFailure.SEALER_FAILED, { cause: SealerCause.SESSION_KEY_STORE_UNAVAILABLE });
      expect(sealRetryingNotice({ action: 'RETRY', delayMs: 30_000, retry: 2, of: 3 }, sealCauseWithoutConclusion(reason))).toBe(
        "Sealing is being retried (retry 2 of 3, in 30 s). The Core's key store cannot be used: the seal stopped and can be tried again.",
      );
    });
  });

  describe('G75d-02: the bounded design, kept', () => {
    it('3. three automatic retries (5 s, 30 s, 120 s) per process, then WAIT - never a fourth; the shared constant is that bound', () => {
      expect(SEAL_RETRY_DEFAULTS.delaysMs).toEqual([5_000, 30_000, 120_000]);
      expect(SEAL_AUTOMATIC_RETRIES).toBe(SEAL_RETRY_DEFAULTS.delaysMs.length);
      const steps = [0, 1, 2, 3, 4, 50].map((done) => sealWayOutOf(failed({ attempt: done + 1 }), done, SEAL_RETRY_DEFAULTS));
      expect(steps.slice(0, 3)).toEqual([
        { action: 'RETRY', delayMs: 5_000, retry: 1, of: 3 },
        { action: 'RETRY', delayMs: 30_000, retry: 2, of: 3 },
        { action: 'RETRY', delayMs: 120_000, retry: 3, of: 3 },
      ]);
      // After the third retry the Core waits: for a start of the Core or operation 33. However long it stays up.
      expect(steps.slice(3)).toEqual([{ action: 'WAIT' }, { action: 'WAIT' }, { action: 'WAIT' }]);
    });
  });
});

describe('G75d-02: the sentences of a blocked seal (wave L, closing pass L-Z)', () => {
  // Fix wave L, closing pass L-Z - re-check 75 finding G75d-02, decision 3 of implementation/155: the
  // Core's own sentences of a BLOCKED seal said "then start recovery for the session or restart the
  // Core" and "tried again ... by the recovery action". No screen offers a control of that name: the
  // retry (operation 33) is "Retry sealing" on the web console's Session Monitor, for an investigator
  // or a supervisor; after its automatic retries the Core WAITS.
  //
  // | Rule | Test |
  // |------|------|
  // | Every restore hint ends with the retry by its screen name, who presses it and where, and the restart - from the ONE shared sentence | 1 |
  // | No sentence of a blocked seal says "start recovery", "recovery action" or names an operation, a permission or a code | 1, 2 |
  // | The failed step's sentence once the retries are used up: the cause, "stopped after n automatic retries", and that the Core waits; n is the bound of the settings in force | 2, 4 |
  // | The examples the clients build on are the Core's words, character for character | 3 |
  // | Every notice fits the engine door's bound; the door refuses a longer one (negative control) | 5 |
  // | A Core that CLOSES before its retries are used up does not say "stopped after n retries" | 6 |

  const DETAILS: SealingDetail[] = [{}, { trackId: 'VIDEO-02' }, ...Object.values(SealerCause).map((cause) => ({ cause }))];
  /** Words of the contract and of the code that an operator's sentence must not carry. */
  const NOT_FOR_AN_OPERATOR = /start recovery|recovery action|recovery operation|recoverSession|operation 33|SESSION_START|SEAL_RETRY|[A-Z]{3,}_[A-Z_]{3,}/;

  describe('G75d-02 (closing pass L-Z): the Core names the retry by the name its screen has', () => {
    it('1. every restore hint ends with "Retry sealing" on the Session Monitor of the web console, an investigator or a supervisor, or a restart', () => {
      expect(SEAL_RETRY_CONTROL_NAME).toBe('Retry sealing');
      expect(SEAL_RETRY_HOW_SENTENCE).toBe('an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console, or the Core is restarted.');
      // The sentence says who; the contract says the same two roles and not the technician.
      expect([OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR, OperatorRole.TECHNICIAN].map(canRetryBlockedSeal)).toEqual([true, true, false]);
      let hints = 0;
      for (const code of Object.values(SealingFailure)) {
        for (const detail of DETAILS) {
          const hint = sealBlockedRestoreHint(code, detail);
          hints += 1;
          expect(hint.endsWith(`, then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`), `${code}: ${hint}`).toBe(true);
          expect(hint, code).not.toMatch(NOT_FOR_AN_OPERATOR);
          const notice = sealBlockedNotice(code, detail);
          expect(notice, code).toContain(hint);
          expect(notice, code).toContain(`"${SEAL_RETRY_CONTROL_NAME}"`);
          expect(notice, code).not.toMatch(/start recovery|recovery action|recoverSession|operation 33/);
          expect(notice.endsWith(' The Core records no new session until this one is sealed.')).toBe(true);
        }
      }
      expect(hints).toBeGreaterThan(100);
    });

    it('2. the failed step once the retries are used up: the cause, then "stopped after 3 automatic retries: the Core now waits ..."', () => {
      const reason = sealingFailureReason(SealingFailure.SEALER_FAILED, { cause: SealerCause.SESSION_KEY_STORE_UNAVAILABLE });
      expect(sealWaitingNotice(reason)).toBe(
        "The Core's key store cannot be used: the seal stopped and can be tried again. Sealing stopped after 3 automatic retries: the Core now waits and does not run it again by itself.",
      );
      expect(sealWaitingNotice(reason)).toBe(`${reason} ${sealStoppedSentence(SEAL_AUTOMATIC_RETRIES)}`);
      expect(sealWaitingNotice(reason)).not.toMatch(NOT_FOR_AN_OPERATOR);
      // CONTROL: the sentence of before is what this test refuses.
      expect(`${reason} Sealing will be tried again when the Core starts, or by the recovery action.`).toMatch(NOT_FOR_AN_OPERATOR);
      expect("Check the Core's database, then start recovery for the session or restart the Core.").toMatch(NOT_FOR_AN_OPERATOR);
    });

    it('3. the shared examples are the Core\'s own words', () => {
      const cause = { cause: SealerCause.SESSION_KEY_STORE_UNAVAILABLE };
      expect(SEAL_BLOCKED_EXAMPLE_ALERT.message).toBe(sealBlockedNotice(SealingFailure.SEALER_FAILED, cause));
      expect(SEAL_BLOCKED_EXAMPLE_FINALIZATION?.steps[0]?.detail).toBe(sealWaitingNotice(sealingFailureReason(SealingFailure.SEALER_FAILED, cause)));
      expect(SEAL_BLOCKED_EXAMPLE_ALERT.message).toContain('presses "Retry sealing" on the Session Monitor of the web console');
    });

    it('4. the number is the bound of the settings in force, and the default IS the shared constant', () => {
      expect(SEAL_RETRY_DEFAULTS.delaysMs.length).toBe(SEAL_AUTOMATIC_RETRIES);
      expect(sealWaitingNotice('X.', 1)).toBe('X. Sealing stopped after 1 automatic retry: the Core now waits and does not run it again by itself.');
      expect(sealWaitingNotice('X.', 2)).toContain('after 2 automatic retries');
    });

    it('5. every notice fits the door; the door refuses a longer message and takes the longest notice', () => {
      let longest = '';
      for (const code of Object.values(SealingFailure)) {
        for (const detail of DETAILS) {
          const notice = sealBlockedNotice(code, detail);
          if (notice.length > longest.length) longest = notice;
        }
      }
      expect(longest.length).toBeLessThanOrEqual(SEAL_BLOCKED_MESSAGE_MAX);
      // The reason this pass moved the bound: the longest notice does not fit the 400 of before.
      expect(longest.length).toBeGreaterThan(400);
      const state = { session: { id: 'SES-20261011-0047', state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION }, alerts: [], meta: { counters: { ALR: 4 } } } as unknown as SimState;
      const input = { sessionId: 'SES-20261011-0047', cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS' };
      expect(raiseSealBlockedTransition(state, 1, { ...input, message: longest }).alerts.at(-1)?.message).toBe(longest);
      expect(() => raiseSealBlockedTransition(state, 1, { ...input, message: 'x'.repeat(SEAL_BLOCKED_MESSAGE_MAX + 1) })).toThrow();
    });

    it('6. a Core that closes before its retries are used up says only that the next start runs the seal', () => {
      expect(sealClosingNotice('X.')).toBe('X. Sealing will be tried again when the Core starts.');
      expect(sealClosingNotice('X.')).not.toMatch(/automatic retries|Retry sealing/);
    });
  });
});
