// Backend task W57: the pure part of the Pair screen in LIVE mode (`pairing-live-model.ts`), and the
// two outcome kinds it adds to the existing model (04_client_integration_spec §9.4; decision D116).
import { describe, expect, it } from '@jest/globals';
import { CoreRefusalError, LiveLinkState, LiveTransportError, LiveTransportReason } from '@dems/shared/live';
import { PairingState, SimErrorCode, SimPermissionError, SimTransitionError } from '@dems/shared/sim';
import {
  PAIR_RETRY,
  failureOutcomeOf,
  isJudged,
  keepsCode,
  liveLinkViewFor,
  liveOutcomeOf,
  liveRingStateFor,
  liveStatusKeyFor,
  liveStepStatusesFor,
  noticeStatusFor,
  offlineNoticeAfter,
  retryAtOf,
  retryWaitMs,
} from './pairing-live-model';
import { pairingViewFor, ringStateFor, stepStatusesFor, type PairOutcome } from './pairing-model';

const NOW = 1_000_000;

describe('the Live link as the screen words it', () => {
  it('OFFLINE and STALE show the notice, ONLINE hides it, and the transients keep what is shown', () => {
    expect(offlineNoticeAfter(false, LiveLinkState.OFFLINE)).toBe(true);
    expect(offlineNoticeAfter(false, LiveLinkState.STALE)).toBe(true);
    expect(offlineNoticeAfter(true, LiveLinkState.ONLINE)).toBe(false);
    // The first connect of a start: no notice flashes.
    expect(offlineNoticeAfter(false, LiveLinkState.CONNECTING)).toBe(false);
    expect(offlineNoticeAfter(false, LiveLinkState.RESYNCING)).toBe(false);
    // Between two reconnect attempts of a dead link: the notice stays.
    expect(offlineNoticeAfter(true, LiveLinkState.CONNECTING)).toBe(true);
    expect(offlineNoticeAfter(true, LiveLinkState.RESYNCING)).toBe(true);
    // Simulated mode has no Live link and no notice.
    expect(offlineNoticeAfter(true, null)).toBe(false);
  });

  it('a dead link that keeps retrying never flickers the notice: OFFLINE, CONNECTING, OFFLINE …', () => {
    let shown = false;
    const seen: boolean[] = [];
    for (const link of [LiveLinkState.CONNECTING, LiveLinkState.OFFLINE, LiveLinkState.CONNECTING, LiveLinkState.OFFLINE, LiveLinkState.CONNECTING, LiveLinkState.ONLINE]) {
      shown = offlineNoticeAfter(shown, link);
      seen.push(shown);
    }
    expect(seen).toEqual([false, true, true, true, true, false]);
  });

  it('`online` only when a redeem would be sent; `offline` while the notice shows; else `connecting`', () => {
    expect(liveLinkViewFor(LiveLinkState.ONLINE, false)).toBe('online');
    expect(liveLinkViewFor(LiveLinkState.CONNECTING, false)).toBe('connecting');
    expect(liveLinkViewFor(LiveLinkState.RESYNCING, false)).toBe('connecting');
    expect(liveLinkViewFor(null, false)).toBe('connecting');
    expect(liveLinkViewFor(LiveLinkState.CONNECTING, true)).toBe('offline');
    expect(liveLinkViewFor(LiveLinkState.OFFLINE, true)).toBe('offline');
  });
});

describe('outcomes of a redeem', () => {
  it('an answered redeem: as the simulator\'s, and the hand-off counts from the moment the answer landed', () => {
    // The answer's own `pairedAt` is the Core's instant; the request was out since then.
    expect(liveOutcomeOf({ ok: true, pairedAt: 42 }, NOW)).toEqual({ kind: 'paired', pairedAt: NOW });
    expect(liveOutcomeOf({ ok: false, reason: 'INVALID_CODE', attemptsRemaining: 2 }, NOW)).toEqual({ kind: 'invalid', attemptsRemaining: 2 });
    expect(liveOutcomeOf({ ok: false, reason: 'LOCKED', lockedUntil: NOW + 60_000, retryInMs: 60_000 }, NOW)).toEqual({ kind: 'locked' });
  });

  it('a 429 is a limit, never a wrong code: no count of attempts, and the wait is at least `retry-after` (decision D116)', () => {
    const limit = new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 41 });
    const outcome = failureOutcomeOf(limit, 1, NOW);
    expect(outcome).toEqual({ kind: 'limited', retryAt: NOW + 41_000, exhausted: false });
    expect(outcome).not.toHaveProperty('attemptsRemaining');
    expect(pairingViewFor({ simState: PairingState.UNPAIRED, phase: null, lockSeconds: 0, outcome })).toBe('failed');
    // Told apart by the status alone, and by the code alone.
    expect(failureOutcomeOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 429 }), 1, NOW)?.kind).toBe('limited');
    expect(failureOutcomeOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { code: 'RATE_LIMITED' }), 1, NOW)?.kind).toBe('limited');
    // A short `retry-after` never undercuts the pacing; none at all leaves the pacing.
    expect(failureOutcomeOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 429, retryAfterSeconds: 1 }), 1, NOW)).toMatchObject({ retryAt: NOW + 3_000 });
    expect(failureOutcomeOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 429 }), 2, NOW)).toMatchObject({ retryAt: NOW + 6_000 });
    // A fraction of a second is rounded up, as the presenter rounds it.
    expect(failureOutcomeOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 429, retryAfterSeconds: 40.2 }), 1, NOW)).toMatchObject({ retryAt: NOW + 41_000 });
  });

  it('no judgement of the code: the reason says whether the code may be used up', () => {
    const reasonOf = (error: unknown) => {
      const outcome = failureOutcomeOf(error, 1, NOW);
      return outcome?.kind === 'unavailable' ? outcome.reason : outcome?.kind;
    };
    // The link was down: the Live source sent nothing (no status, no code).
    expect(reasonOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE))).toBe('OFFLINE');
    // 503: the Core answered that it is not ready. The code was not checked.
    expect(reasonOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { status: 503, code: 'NOT_READY' }))).toBe('OFFLINE');
    // The request left and no answer came: the Core may have redeemed the code.
    expect(reasonOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: 'TIMEOUT' }))).toBe('NO_ANSWER');
    expect(reasonOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: 'NETWORK' }))).toBe('NO_ANSWER');
    expect(reasonOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: 'SNAPSHOT_TIMEOUT' }))).toBe('NO_ANSWER');
    // A 500, an answer outside the contract, a refusal that is not about the code.
    expect(reasonOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 500, code: 'INTERNAL_ERROR' }))).toBe('FAILED');
    expect(reasonOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { code: 'CONTRACT_VIOLATION' }))).toBe('FAILED');
    expect(reasonOf(new CoreRefusalError('ORIGIN_NOT_ALLOWED', { status: 403 }))).toBe('FAILED');
    expect(reasonOf(new SimPermissionError('pair', 'PAIRING_MANAGE', SimErrorCode.NOT_SIGNED_IN))).toBe('FAILED');
    // The tablet could not keep the credential (the secrets port failed).
    expect(reasonOf(new CoreRefusalError('NOT_AVAILABLE'))).toBe('STORAGE');
    // Not the presenter's: the screen's own generic alert, as before Live mode.
    expect(reasonOf(new SimTransitionError(null, 'pair'))).toBe('error');
    expect(reasonOf(new Error('anything'))).toBe('error');
    expect(reasonOf('not an error')).toBe('error');
  });

  it('a stopped Live source shows nothing: the screen that sent the code is gone', () => {
    expect(failureOutcomeOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: 'STOPPED' }), 1, NOW)).toBeNull();
  });

  it('Retry is paced 3 s, 6 s, 12 s, and withdrawn after the third attempt in a row', () => {
    expect([1, 2, 3, 4, 9].map((attempt) => retryWaitMs(attempt, null))).toEqual([3_000, 6_000, 12_000, 12_000, 12_000]);
    expect(retryWaitMs(0, null)).toBe(3_000);
    expect(retryWaitMs(1, 30)).toBe(30_000);
    // A fraction of a second is rounded UP: the tablet never asks before the server allows it.
    expect(retryWaitMs(1, 40.2)).toBe(41_000);
    expect(retryWaitMs(1, 3.0001)).toBe(4_000);
    expect(retryWaitMs(3, 5)).toBe(12_000);
    expect(retryWaitMs(1, Number.NaN)).toBe(3_000);
    expect(retryWaitMs(1, -4)).toBe(3_000);
    const failed = new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 500 });
    expect([1, 2, 3, 4].map((attempt) => failureOutcomeOf(failed, attempt, NOW))).toEqual([
      { kind: 'unavailable', reason: 'FAILED', retryAt: NOW + 3_000, exhausted: false },
      { kind: 'unavailable', reason: 'FAILED', retryAt: NOW + 6_000, exhausted: false },
      { kind: 'unavailable', reason: 'FAILED', retryAt: NOW + 12_000, exhausted: true },
      { kind: 'unavailable', reason: 'FAILED', retryAt: NOW + 12_000, exhausted: true },
    ]);
    expect(PAIR_RETRY.maxRetries).toBe(3);
  });

  it('which outcomes the Core judged, which keep the typed code, and when the next attempt may start', () => {
    const outcomes: Record<string, PairOutcome> = {
      paired: { kind: 'paired', pairedAt: NOW },
      invalid: { kind: 'invalid', attemptsRemaining: 1 },
      locked: { kind: 'locked' },
      error: { kind: 'error' },
      limited: { kind: 'limited', retryAt: NOW + 5_000, exhausted: false },
      offline: { kind: 'unavailable', reason: 'OFFLINE', retryAt: NOW + 3_000, exhausted: false },
      noAnswer: { kind: 'unavailable', reason: 'NO_ANSWER', retryAt: NOW + 3_000, exhausted: false },
      storage: { kind: 'unavailable', reason: 'STORAGE', retryAt: NOW + 3_000, exhausted: false },
    };
    const judged = Object.entries(outcomes).filter(([, outcome]) => isJudged(outcome)).map(([name]) => name);
    expect(judged).toEqual(['paired', 'invalid', 'locked']);
    // A wrong code is cleared; a code the Core never judged stays for the retry; a redeemed code whose credential was lost is used up.
    const kept = Object.entries(outcomes).filter(([, outcome]) => keepsCode(outcome)).map(([name]) => name);
    expect(kept).toEqual(['limited', 'offline', 'noAnswer']);
    expect(retryAtOf(outcomes.limited!)).toBe(NOW + 5_000);
    expect(retryAtOf(outcomes.storage!)).toBe(NOW + 3_000);
    expect(retryAtOf(outcomes.invalid!)).toBeNull();
    expect(retryAtOf(outcomes.paired!)).toBeNull();
    expect(retryAtOf(null)).toBeNull();
    // The two new kinds are the `failed` view of the existing model; the existing kinds are as they were.
    const view = (outcome: PairOutcome) => pairingViewFor({ simState: PairingState.UNPAIRED, phase: null, lockSeconds: 0, outcome });
    expect([view(outcomes.limited!), view(outcomes.offline!), view(outcomes.invalid!), view(outcomes.error!), view(outcomes.locked!)]).toEqual(['failed', 'failed', 'failed', 'failed', 'unpaired']);
  });
});

describe('the connection pane in LIVE mode', () => {
  it('Discover is in error and the ring critical while the Core is unreachable; an attempt in flight and a paired tablet keep their view', () => {
    expect(liveStepStatusesFor('unpaired', null, 'offline')).toEqual(['error', 'pending', 'pending']);
    expect(liveStepStatusesFor('failed', null, 'offline')).toEqual(['error', 'pending', 'pending']);
    expect(liveStepStatusesFor('locked', null, 'offline')).toEqual(['error', 'pending', 'pending']);
    expect(liveRingStateFor('unpaired', 'offline')).toBe('critical');
    expect(liveStepStatusesFor('pairing', 'verify', 'offline')).toEqual(stepStatusesFor('pairing', 'verify'));
    expect(liveStepStatusesFor('paired', null, 'offline')).toEqual(stepStatusesFor('paired', null));
    expect(liveRingStateFor('paired', 'offline')).toBe(ringStateFor('paired'));
    // With the link up, or still connecting, the pane is the simulator's.
    for (const link of ['online', 'connecting'] as const) {
      for (const view of ['unpaired', 'pairing', 'paired', 'failed', 'locked'] as const) {
        expect(liveStepStatusesFor(view, 'discover', link)).toEqual(stepStatusesFor(view, 'discover'));
        expect(liveRingStateFor(view, link)).toBe(ringStateFor(view));
      }
    }
  });

  it('the status line: what is in flight, then the pairing, then the link, then the last outcome', () => {
    const key = (input: Partial<Parameters<typeof liveStatusKeyFor>[0]>) => liveStatusKeyFor({ view: 'unpaired', phase: null, sent: false, link: 'online', outcome: null, ...input });
    expect(key({})).toBe('idle');
    expect(key({ link: 'connecting' })).toBe('connecting');
    expect(key({ link: 'offline' })).toBe('offline');
    expect(key({ view: 'pairing', phase: 'discover' })).toBe('discovering');
    expect(key({ view: 'pairing', phase: 'verify' })).toBe('verifying');
    // Past `commitAt` the request is out; the phase alone does not say so.
    expect(key({ view: 'pairing', phase: 'commit' })).toBe('verifying');
    expect(key({ view: 'pairing', phase: 'commit', sent: true })).toBe('sent');
    expect(key({ view: 'pairing', phase: 'commit', sent: true, link: 'offline' })).toBe('sent');
    expect(key({ view: 'paired', link: 'offline' })).toBe('paired');
    expect(key({ view: 'locked' })).toBe('locked');
    expect(key({ view: 'locked', link: 'offline' })).toBe('offline');
    expect(key({ view: 'failed', outcome: { kind: 'invalid', attemptsRemaining: 2 } })).toBe('failed');
    // A limit and an outage are never worded as a refused code.
    expect(key({ view: 'failed', outcome: { kind: 'limited', retryAt: NOW, exhausted: false } })).toBe('unavailable');
    expect(key({ view: 'failed', outcome: { kind: 'unavailable', reason: 'FAILED', retryAt: NOW, exhausted: false } })).toBe('unavailable');
    expect(key({ view: 'failed', outcome: { kind: 'error' } })).toBe('unavailable');
  });

  it('the notices of the gate: a refusal of the Core is danger, an unpair that was asked for is information', () => {
    expect(noticeStatusFor('revoked')).toBe('danger');
    expect(noticeStatusFor('unknown')).toBe('danger');
    expect(noticeStatusFor('unpaired')).toBe('accent');
  });
});
