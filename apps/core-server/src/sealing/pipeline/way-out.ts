/**
 * EVERY SEAL FAILURE HAS A WAY OUT (task 3 fix pass F-M7b; review row 88 finding R88-02 (a) + (c);
 * controller rulings D178 (2), D183).
 *
 * A run of the pipeline that ends FAILED used to end there: the next attempt was the next start of
 * the Core, for ever, and a session that is not SEALED blocks every new session. After this file a
 * FAILED run ends in exactly one of:
 *
 *   RETRY      the seal is run again IN THIS PROCESS after a bounded back-off. The operator reads
 *              "Sealing is being retried (retry n of N, in s s). <the cause>" on the failed step.
 *   WAIT       a RETRIABLE cause (storage, the signer, the engine, the journal, the session key, the
 *              transcript step) outlived the retries of this process: the seal is tried again at
 *              the next start of the Core (which has its own retries) and, on demand, by the
 *              recovery operation. The evidence is intact and stays where it is: such a cause is
 *              NEVER terminal - a signing key that is missing for a day must not cost a recording.
 *   TERMINAL   `NOTHING_SEALABLE` (no camera file has a valid fragment) at once; any other cause
 *              no retry gets past once the journal counts `nonRecoverableAttempts` attempts. The
 *              session is ended UNSEALABLE (below) and the Core is free for the next session.
 *
 * THE SETTINGS ARE NAMED (`SealRetrySettings`); the defaults (`SEAL_RETRY_DEFAULTS`): three
 * retries per process, 5 s, 30 s and 120 s after the failure before; terminal at the third
 * attempt of a cause no retry gets past. The attempts are the journal's (`sealing_jobs.attempt`):
 * they survive a restart, so a Core that restarts between attempts reaches the bound all the same.
 *
 * THE TERMINAL OUTCOME, in this order - each step can be done again, so a Core that dies anywhere
 * in it finishes at its next start (`finishPending`) WITHOUT running the seal again:
 *
 *   1. THE JOURNAL IS CLOSED: the row of the failed step says FAILED with the error code
 *      `UNSEALABLE` and keeps `{ unsealable: { cause, at } }` in its checkpoint. No start runs a
 *      seal for a session whose journal says so.
 *   2. EVERY FILE THE SESSION LEFT IS MOVED - never deleted - to
 *      `<mediaStoreRoot>/.quarantine/<sessionId>/`: all of its package folder (the recordings, what
 *      was sealed and never committed, anything else) and all of its staging folder (under
 *      `sealing/`). Folders 0700, files 0600. A name that is taken gets a counted suffix. The two
 *      folders, then empty, are removed.
 *   3. THE ENGINE ENDS THE SESSION (`endSessionUnsealable`): INCOMPLETE with reason UNSEALABLE and
 *      the cause, ONE CRITICAL alert, ONE audit row; no open session afterwards.
 *
 * This file names no clock and opens no connection: everything comes through `SealWayOutPorts`.
 */
import { constants as FS } from 'node:fs';
import { chmod, lstat, mkdir, open, readdir, rename, rmdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SEAL_RETRY_HOW_SENTENCE, sealStoppedSentence, type SealingProgressInput } from '@dems/shared/sim';
import { describeError, type ErrorLog } from '../../plugins/logger';
import type { StepTimer } from '../finalize-transcript/bounds';
import type { SealingStepJournal, SealingStepRecord, StepCheckpoint } from '../step-journal';
import { SEALING_STEP_ORDER, SealerCause, SealingFailure, sealerCauseIn, sealingCauseCodeOf, sealingFailureReason, type SealOutcome, type SealingDetail, type SealingStepId } from './contract';

const SOURCE = 'sealing.wayOut';

/** The bounds of the retries of a failed seal. */
export interface SealRetrySettings {
  /** The wait before each retry IN ONE PROCESS, in order; its length is the number of retries. */
  readonly delaysMs: readonly number[];
  /** The attempt (the journal's count, over restarts) at which a cause no retry gets past ends the session as UNSEALABLE. At least 1. */
  readonly nonRecoverableAttempts: number;
}

/** Three retries per process - 5 s, 30 s, 120 s - and terminal at the third attempt of a cause no retry gets past. */
export const SEAL_RETRY_DEFAULTS: SealRetrySettings = Object.freeze({ delaysMs: Object.freeze([5_000, 30_000, 120_000]) as readonly number[], nonRecoverableAttempts: 3 });

/** `sealing_jobs.error_code` of the step whose failure ended its session as UNSEALABLE: the journal is closed. */
export const SEALING_UNSEALABLE_CODE = 'UNSEALABLE';

export type SealWayOutStep =
  | { readonly action: 'RETRY'; readonly delayMs: number; readonly retry: number; readonly of: number }
  | { readonly action: 'WAIT' }
  | { readonly action: 'TERMINAL'; readonly cause: string };

type FailedOutcome = Extract<SealOutcome, { status: 'FAILED' }>;

/** THE RULE. `retriesDone`: the retries this process already started for that session. */
export function sealWayOutOf(outcome: FailedOutcome, retriesDone: number, settings: SealRetrySettings): SealWayOutStep {
  if (outcome.code === SealingFailure.NOTHING_SEALABLE) return { action: 'TERMINAL', cause: outcome.code };
  // G75b-01 (fix wave I): the terminal outcome names the CAUSE when the failure carries one (`SESSION_KEY_NOT_OF_SESSION`, not `SEALER_FAILED`).
  if (!outcome.retriable && outcome.attempt >= Math.max(1, settings.nonRecoverableAttempts)) return { action: 'TERMINAL', cause: sealingCauseCodeOf(outcome.code, outcome.detail) };
  const delayMs = settings.delaysMs[retriesDone];
  if (delayMs === undefined) return { action: 'WAIT' };
  return { action: 'RETRY', delayMs: Math.max(0, delayMs), retry: retriesDone + 1, of: settings.delaysMs.length };
}

/** What the operator reads on the failed step while the seal is retried, and while it waits for a start. */
export const sealRetryingNotice = (step: Extract<SealWayOutStep, { action: 'RETRY' }>, reason: string): string => `Sealing is being retried (retry ${step.retry} of ${step.of}, in ${Math.ceil(step.delayMs / 1_000)} s). ${reason}`;
/**
 * THE CAUSE WITHOUT ITS CONCLUSION (fix wave L, driver L-S; re-check 75 finding G75d-04). The reason
 * of a cause no retry gets past ends "... this session cannot be sealed." That conclusion is true at
 * the TERMINAL end only - where the notice of the unsealable session says it. While the bounded
 * attempts still run, the failed step read "Sealing is being retried (...)" and "this session
 * cannot be sealed" in one sentence. The retry sentence states the cause and stops there.
 */
export function sealCauseWithoutConclusion(reason: string): string {
  return reason.replace(/: this session cannot be sealed\.$/i, '.').replace(/\s+This session cannot be sealed\.$/i, '');
}
/**
 * The failed step's sentence once the automatic retries are used up (closing pass L-Z, G75d-02): the cause, and
 * what the Core did by itself and does now - it WAITS. It said "tried again ... by the recovery action", a name no
 * screen has; who retries, where, and under which name is in the alert (`sealBlockedNotice`), which every surface
 * draws beside this sentence. `retries`: the automatic retries of the settings in force.
 */
export const sealWaitingNotice = (reason: string, retries: number = SEAL_RETRY_DEFAULTS.delaysMs.length): string => `${reason} ${sealStoppedSentence(retries)}`;
/** The failed step's sentence when the Core CLOSES before its retries are used up: the next start has its own retries. */
export const sealClosingNotice = (reason: string): string => `${reason} Sealing will be tried again when the Core starts.`;

/**
 * WHAT RESTORES A SEAL THAT IS BLOCKED (fix pass F-M7c; ruling D186 (1)). Closing pass L-Z (G75d-02): every hint ends with the
 * retry BY THE NAME ITS SCREEN GIVES IT and who presses it (`SEAL_RETRY_HOW_SENTENCE` of the shared package) - it said
 * "start recovery for the session", which no screen offers.
 * A retriable cause that
 * never goes away keeps its session FINALIZING and the Core blocked - the safe side for evidence
 * that is intact. It must be VISIBLE: this sentence is in the CRITICAL alert and in the log.
 */
export function sealBlockedRestoreHint(code: string, detail: SealingDetail = {}): string {
  switch (code) {
    case SealingFailure.SEALER_FAILED:
      // G75b-01 (fix wave I): the hint follows the CAUSE. A key that was never made cannot be "restored".
      switch (sealerCauseIn(code, detail)) {
        case SealerCause.SESSION_KEY_STORE_UNAVAILABLE:
        case SealerCause.SESSION_KEY_UNSAFE:
        case SealerCause.SESSION_KEY_WRITE_FAILED:
          return `Check the Core's key store (the credential store folder of the data directory: a private folder the server user can write), then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
        case SealerCause.SESSION_KEY_NOT_OF_SESSION:
          return `An administrator must remove the earlier session's key from the Core's key store, then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
        case SealerCause.SESSION_CIPHER_REFUSED:
          return `Read the Core's error log for the cause, then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
        default:
          return `Restore the session key of this session to the Core's key store (from the copy of the data directory it was in), then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
      }
    case SealingFailure.FRAGMENT_NOT_OPENABLE:
      return `Restore the session key of this session to the Core's key store (from the copy of the data directory it was in), then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
    case SealingFailure.SIGNER_FAILED:
      return `Provide the Core's evidence signing key (the signer folder of the data directory), then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
    case SealingFailure.STORAGE_FAILED:
      return `Check the evidence store (free space, permissions, the volume is mounted), then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
    case SealingFailure.JOURNAL_FAILED:
    case SealingFailure.ENGINE_REFUSED:
      return `Check the Core's database, then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
    case SealingFailure.TRANSCRIPT_STEP_FAILED:
      return `Check the transcription service and its working folder, then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
    default:
      return `Read the Core's error log for the cause, then retry the seal: ${SEAL_RETRY_HOW_SENTENCE}`;
  }
}

/** The text of the CRITICAL alert of a blocked seal: the cause in words, what restores it (the retry by its screen name, and who presses it), what it costs meanwhile. */
export const sealBlockedNotice = (code: string, detail: SealingDetail = {}): string => `Sealing of this session is blocked. ${sealingFailureReason(code as SealingFailure, detail)} ${sealBlockedRestoreHint(code, detail)} The Core records no new session until this one is sealed.`;

export interface SealWayOutPorts {
  /**
   * F-M7c (D186 (1)): the seal of the session failed for a cause that may heal and the retries of
   * this process are used up. The engine raises ONE CRITICAL alert (once per session). Best effort:
   * a rejection is logged, the wait is the same.
   */
  readonly blocked?: (input: { sessionId: string; cause: string; step: string; message: string; detail?: string }) => Promise<void>;
  /** F-M7c: the blocked alert of the session is resolved - its seal completed, or the session was ended. */
  readonly unblocked?: (sessionId: string) => Promise<void>;
  readonly settings: () => SealRetrySettings;
  readonly timer: StepTimer;
  readonly journal: SealingStepJournal;
  readonly now: () => number;
  readonly log: ErrorLog;
  /** Another attempt for the session of the committed state (the controller's `resume`). Its outcome comes back through `after`. */
  readonly retry: () => Promise<unknown>;
  /** The engine's `applySealingProgress`: the step states with the sentence of the way out. */
  readonly tell: (input: SealingProgressInput) => Promise<void>;
  /** The engine's `endSessionUnsealable`. Rejects when the session could not be ended. */
  readonly end: (input: { sessionId: string; cause: string; quarantinedFiles: number }) => Promise<void>;
  readonly packageDir: (sessionId: string) => string;
  readonly stagingDir: (sessionId: string) => string;
  /** `<mediaStoreRoot>/.quarantine/<sessionId>`, on the volume of the two folders above. */
  readonly quarantineDir: (sessionId: string) => string;
  /**
   * F-M7c (ruling D186, F-M7b's decision 6): the transcriber scratch folder of the session
   * (`<mediaStoreRoot>/.transcriber/sessions/<id>`: its raw audio tap), or null when there is
   * none. The port ENDS the session's transcription run before it answers, so nothing writes into
   * the folder while it is moved to `<quarantine>/transcriber/`.
   */
  readonly scratchDir?: (sessionId: string) => string | null;
}

export interface SealWayOut {
  /** Called with the end of EVERY run. Resolves with what was decided (null for a run that did not fail). */
  after(outcome: SealOutcome): Promise<SealWayOutStep | null>;
  /** True when the journal of the session says UNSEALABLE: the terminal outcome is finished (move what is left, end the session) and no seal is run. */
  finishPending(sessionId: string): Promise<boolean>;
  /** The session a retry is scheduled for, or null. */
  pending(): string | null;
  /** Forgets the retries counted for the session and cancels a scheduled one: a retry ON DEMAND starts from the first delay. */
  reset(sessionId: string): void;
  /** Cancels every scheduled retry (the Core closes). */
  close(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

async function syncDirectory(dir: string): Promise<void> {
  const handle = await open(dir, FS.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Owner-only for everything below `path`: folders 0700, regular files 0600. A link is left as the link it is. Returns the regular files. */
async function closeToOthers(path: string): Promise<number> {
  const facts = await lstat(path);
  if (facts.isDirectory()) {
    await chmod(path, 0o700);
    let files = 0;
    for (const name of await readdir(path)) files += await closeToOthers(join(path, name));
    return files;
  }
  if (facts.isFile()) {
    await chmod(path, 0o600);
    return 1;
  }
  return 0;
}

/** Moves every entry of `from` into `to` (made owner-only), never over a name that is there. Returns the regular files moved. */
async function moveEntries(from: string, to: string): Promise<number> {
  let names: string[];
  try {
    names = (await readdir(from)).sort();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return 0;
    throw error;
  }
  if (names.length === 0) return 0;
  await mkdir(to, { recursive: true, mode: 0o700 });
  let files = 0;
  for (const name of names) {
    let target = name;
    for (let count = 1; ; count += 1) {
      try {
        await lstat(join(to, target));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
        throw error;
      }
      target = `${name}.${count}`;
    }
    await rename(join(from, name), join(to, target));
    files += await closeToOthers(join(to, target));
  }
  await syncDirectory(to);
  await syncDirectory(from);
  return files;
}

/** Removes a folder that is EMPTY (`rmdir` removes nothing else); a folder that is not there or not empty is left. */
async function removeEmpty(dir: string): Promise<void> {
  try {
    await rmdir(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTEMPTY' && code !== 'EEXIST') throw error;
  }
}

/**
 * STEP 2 OF THE TERMINAL OUTCOME: everything the session left on the media store is MOVED to its
 * quarantine folder. Nothing is deleted and nothing is overwritten. Can be called again: what is
 * moved already is not there any more. Returns the number of regular files moved by THIS call.
 */
export async function quarantineSessionFiles(folders: { readonly packageDir: string; readonly stagingDir: string; readonly quarantineDir: string; readonly scratchDir?: string | null }): Promise<number> {
  const scratch = folders.scratchDir ?? null;
  const moved =
    (await moveEntries(folders.packageDir, folders.quarantineDir)) +
    (await moveEntries(folders.stagingDir, join(folders.quarantineDir, 'sealing'))) +
    // The raw audio tap and the rest of the transcriber scratch (F-M7c): evidence the Core could not seal, kept with the recordings.
    (scratch === null ? 0 : await moveEntries(scratch, join(folders.quarantineDir, 'transcriber')));
  if (moved > 0) {
    // The quarantine root and the session's folder in it are the owner's alone, whoever made them.
    await chmod(dirname(folders.quarantineDir), 0o700);
    await chmod(folders.quarantineDir, 0o700);
    await syncDirectory(dirname(folders.quarantineDir));
  }
  await removeEmpty(folders.packageDir);
  await removeEmpty(folders.stagingDir);
  if (scratch !== null) await removeEmpty(scratch);
  return moved;
}

/** The cause a journal row was closed with, or null when the row does not say UNSEALABLE. */
export function unsealableCauseOf(row: SealingStepRecord | null): string | null {
  if (row === null || row.errorCode !== SEALING_UNSEALABLE_CODE) return null;
  const mark = isRecord(row.checkpoint) ? row.checkpoint.unsealable : null;
  return isRecord(mark) && typeof mark.cause === 'string' ? mark.cause : SealingFailure.STEP_FAILED;
}

export function createSealWayOut(ports: SealWayOutPorts): SealWayOut {
  const retries = new Map<string, number>();
  const scheduled = new Map<string, () => void>();
  let closed = false;

  const rowsOf = async (sessionId: string): Promise<Map<SealingStepId, SealingStepRecord | null>> => {
    const rows = new Map<SealingStepId, SealingStepRecord | null>();
    for (const step of SEALING_STEP_ORDER) rows.set(step, await ports.journal.read(sessionId, step));
    return rows;
  };

  /** The step states of the journal, with `sentence` on the failed step. Best effort: the failure itself is persisted already. */
  async function say(outcome: FailedOutcome, sentence: string): Promise<void> {
    try {
      const rows = await rowsOf(outcome.sessionId);
      await ports.tell({
        sessionId: outcome.sessionId,
        steps: SEALING_STEP_ORDER.map((id) => {
          const row = rows.get(id) ?? null;
          if (id === outcome.step) return { id, status: 'FAILED' as const, progress: row?.progress ?? 0, etaMs: null, attempt: outcome.attempt, detail: sentence };
          return row?.status === 'DONE' ? { id, status: 'DONE' as const, progress: 100, etaMs: 0, attempt: row.attempt, detail: null } : { id, status: 'PENDING' as const, progress: 0, etaMs: null, attempt: outcome.attempt, detail: null };
        }),
      });
    } catch (error) {
      ports.log.append({ level: 'error', source: SOURCE, message: 'the session could not be told what follows its failed seal', ...describeError(error), code: 'SEALING_WAY_OUT_NOT_TOLD', context: { sessionId: outcome.sessionId, step: outcome.step, attempt: outcome.attempt } });
    }
  }

  /** Steps 2 and 3 of the terminal outcome. Rejects when one of them could not be done: the mark of step 1 stays. */
  async function finish(sessionId: string, cause: string): Promise<void> {
    const quarantinedFiles = await quarantineSessionFiles({ packageDir: ports.packageDir(sessionId), stagingDir: ports.stagingDir(sessionId), quarantineDir: ports.quarantineDir(sessionId), scratchDir: ports.scratchDir?.(sessionId) ?? null });
    await ports.end({ sessionId, cause, quarantinedFiles });
    retries.delete(sessionId);
    await unblock(sessionId);
    ports.log.append({ level: 'error', source: SOURCE, message: 'a session could not be sealed: it was ended as INCOMPLETE (UNSEALABLE) and its files were moved to the quarantine folder', code: 'SEALING_SESSION_UNSEALABLE', context: { sessionId, cause, quarantinedFiles } });
  }

  /** The blocked alert of the session, if one was raised, is resolved. Best effort. */
  async function unblock(sessionId: string): Promise<void> {
    try {
      await ports.unblocked?.(sessionId);
    } catch (error) {
      ports.log.append({ level: 'error', source: SOURCE, message: 'the alert of a blocked seal could not be resolved', ...describeError(error), code: 'SEALING_BLOCKED_NOT_RESOLVED', context: { sessionId } });
    }
  }

  async function terminal(outcome: FailedOutcome, cause: string): Promise<void> {
    const { sessionId, step } = outcome;
    try {
      // 1. THE JOURNAL IS CLOSED FIRST: whatever happens after it, no start runs this seal again.
      const row = await ports.journal.read(sessionId, step);
      const checkpoint: StepCheckpoint = { ...(isRecord(row?.checkpoint) ? row.checkpoint : {}), unsealable: { cause, at: ports.now() } };
      await ports.journal.write({ sessionId, step, status: 'FAILED', progress: row?.progress ?? 0, etaMs: null, attempt: row?.attempt ?? outcome.attempt, checkpoint, errorCode: SEALING_UNSEALABLE_CODE, at: ports.now() });
      await finish(sessionId, cause);
    } catch (error) {
      ports.log.append({ level: 'error', source: SOURCE, message: 'the terminal outcome of a session that cannot be sealed was not finished: it is finished at the next start of the Core', ...describeError(error), code: 'SEALING_UNSEALABLE_NOT_FINISHED', context: { sessionId, step, cause } });
    }
  }

  function cancel(sessionId: string): void {
    scheduled.get(sessionId)?.();
    scheduled.delete(sessionId);
  }

  return Object.freeze({
    async after(outcome: SealOutcome): Promise<SealWayOutStep | null> {
      if (outcome.status !== 'FAILED') {
        retries.delete(outcome.sessionId);
        cancel(outcome.sessionId);
        // F-M7c: a seal that completed is not blocked any more.
        if (outcome.status === 'SEALED') await unblock(outcome.sessionId);
        return null;
      }
      const done = retries.get(outcome.sessionId) ?? 0;
      const next = sealWayOutOf(outcome, done, ports.settings());
      const reason = sealingFailureReason(outcome.code, outcome.detail);
      if (next.action === 'TERMINAL') {
        cancel(outcome.sessionId);
        await terminal(outcome, next.cause);
        return next;
      }
      if (next.action === 'WAIT' || closed) {
        ports.log.append({ level: 'error', source: SOURCE, message: 'the seal of a session failed and the retries of this process are used up: it is tried again at the next start of the Core or by the recovery operation', code: 'SEALING_RETRIES_EXHAUSTED', context: { sessionId: outcome.sessionId, step: outcome.step, attempt: outcome.attempt, failure: outcome.code, cause: sealingCauseCodeOf(outcome.code, outcome.detail) } });
        const automatic = ports.settings().delaysMs.length;
        await say(outcome, next.action === 'WAIT' ? sealWaitingNotice(reason, automatic) : sealClosingNotice(reason));
        // F-M7c (D186 (1)): VISIBLE. Not while the Core closes - the next start has its own retries first.
        if (next.action === 'WAIT' && !closed) {
          const restore = sealBlockedRestoreHint(outcome.code, outcome.detail);
          // G75b-01: the log line and the alert name the CAUSE (a closed code), not only the step that failed.
          const cause = sealerCauseIn(outcome.code, outcome.detail);
          ports.log.append({ level: 'error', source: SOURCE, message: 'the seal of a session is BLOCKED: the session stays FINALIZING and the Core records no new session until it is sealed', code: 'SEALING_SESSION_BLOCKED', context: { sessionId: outcome.sessionId, step: outcome.step, attempt: outcome.attempt, failure: outcome.code, cause: cause ?? outcome.code, restore } });
          try {
            await ports.blocked?.({ sessionId: outcome.sessionId, cause: outcome.code, step: outcome.step, message: sealBlockedNotice(outcome.code, outcome.detail), ...(cause === null ? {} : { detail: cause }) });
          } catch (error) {
            ports.log.append({ level: 'error', source: SOURCE, message: 'the alert of a blocked seal could not be raised', ...describeError(error), code: 'SEALING_BLOCKED_NOT_RAISED', context: { sessionId: outcome.sessionId } });
          }
        }
        return { action: 'WAIT' };
      }
      retries.set(outcome.sessionId, next.retry);
      cancel(outcome.sessionId);
      const sessionId = outcome.sessionId;
      scheduled.set(
        sessionId,
        ports.timer.after(next.delayMs, () => {
          scheduled.delete(sessionId);
          if (closed) return;
          ports.retry().catch((error: unknown) => {
            ports.log.append({ level: 'error', source: SOURCE, message: 'a retry of a failed seal could not start', ...describeError(error), code: 'SEALING_RETRY_REJECTED', context: { sessionId } });
          });
        }),
      );
      ports.log.append({ level: 'warn', source: SOURCE, message: 'the seal of a session failed and is retried in this process', code: 'SEALING_RETRY_SCHEDULED', context: { sessionId, step: outcome.step, attempt: outcome.attempt, failure: outcome.code, cause: sealingCauseCodeOf(outcome.code, outcome.detail), retry: next.retry, of: next.of, delayMs: next.delayMs } });
      // G75d-04: no "cannot be sealed" beside "is being retried" - the conclusion belongs to the terminal end.
      await say(outcome, sealRetryingNotice(next, sealCauseWithoutConclusion(reason)));
      return next;
    },

    async finishPending(sessionId: string): Promise<boolean> {
      let cause: string | null = null;
      for (const row of (await rowsOf(sessionId)).values()) cause ??= unsealableCauseOf(row);
      if (cause === null) return false;
      cancel(sessionId);
      await finish(sessionId, cause);
      return true;
    },

    pending: () => scheduled.keys().next().value ?? null,

    reset(sessionId: string): void {
      retries.delete(sessionId);
      cancel(sessionId);
    },

    close(): void {
      closed = true;
      for (const sessionId of scheduled.keys()) cancel(sessionId);
    },
  });
}
