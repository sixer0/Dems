/**
 * The Pair screen in LIVE mode: the pure part (backend task W57; 04_client_integration_spec §9.4,
 * MP-5 to MP-8; §6.6; decisions D116, D124). No React, no clock, no storage: every function gets
 * what it reads as an argument.
 *
 * What differs from the simulator, and why this file exists:
 *
 * | Point | Simulated | LIVE |
 * |---|---|---|
 * | Who judges the code | The simulator, at once | The Core server; the answer comes later, or not at all |
 * | The link | Always there | Can be down: nothing is sent then, and the screen says so |
 * | A refusal that is no judgement of the code | Does not exist | 429 (a limit), no answer, a 5xx, a credential that could not be stored |
 * | The Core identity before pairing | The dataset's | Not known: an unpaired tablet gets no Core data |
 *
 * **A 429 is a limit, never a wrong code** (decision D116, finding F76): refused calls of a retired
 * credential can fill the shared budget of unauthenticated callers for up to 60 s. The Core counted
 * no attempt and did not look at the code, so the screen shows no count and keeps the code.
 *
 * **Retry is paced** (the agent's retry rule): after an attempt that got no judgement the next one
 * waits 3 s, then 6 s, then 12 s, and never less than the server's `retry-after`. After the third
 * in a row the Retry control is withdrawn; Pair (a deliberate new attempt) stays, behind the wait.
 */
import { LiveLinkState, LiveTransportError } from '@dems/shared/live';
import type { EpochMs, PairResult } from '@dems/shared/sim';
import type { GlowRingState } from '@/components/composed/glow-ring.math';
import type { StepStatus } from '@/components/composed/stepper';
import { describeCoreError, type PairingNotice } from '@/runtime';
import {
  outcomeOf,
  ringStateFor,
  stepStatusesFor,
  type PairOutcome,
  type PairPhase,
  type PairingView,
} from './pairing-model';

// ---------------------------------------------------------------------------------------------
// The link
// ---------------------------------------------------------------------------------------------

/** How the screen words the Live link: it can send, it is still connecting, or the Core is unreachable. */
export type LiveLinkView = 'online' | 'connecting' | 'offline';

/**
 * Whether the "Core server unreachable" notice shows after a change of the Live link. OFFLINE and
 * STALE show it, ONLINE hides it, and CONNECTING and RESYNCING are transients that keep what is
 * shown: with the Core down the link alternates between OFFLINE and CONNECTING at every reconnect
 * attempt, and a notice that follows it would flicker (the rule of the connection banner).
 * `null` is Simulated mode: there is no Live link, and no notice.
 */
export function offlineNoticeAfter(shown: boolean, link: LiveLinkState | null): boolean {
  switch (link) {
    case LiveLinkState.OFFLINE:
    case LiveLinkState.STALE:
      return true;
    case LiveLinkState.CONNECTING:
    case LiveLinkState.RESYNCING:
      return shown;
    default:
      return false;
  }
}

/** `offline` while the notice shows; else `online` only when a redeem would be sent (the Live source sends while ONLINE only, CL-22). */
export function liveLinkViewFor(link: LiveLinkState | null, offlineShown: boolean): LiveLinkView {
  if (offlineShown) return 'offline';
  return link === LiveLinkState.ONLINE ? 'online' : 'connecting';
}

// ---------------------------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------------------------

/** The typed client's word for a request whose connection failed before an answer came (`@dems/shared/client`). */
const NETWORK_CODE = 'NETWORK';

/** The pacing of a retry: 3 s, 6 s, 12 s; after `maxRetries` attempts in a row the Retry control is withdrawn. */
export const PAIR_RETRY = { baseMs: 3_000, maxMs: 12_000, maxRetries: 3 } as const;

/**
 * How long the next attempt waits after `consecutive` attempts in a row that got no judgement
 * (1 = the first). Never less than the server's `retry-after`.
 */
export function retryWaitMs(consecutive: number, retryAfterSeconds: number | null): number {
  const step = Math.max(1, Math.floor(consecutive));
  const paced = Math.min(PAIR_RETRY.baseMs * 2 ** (step - 1), PAIR_RETRY.maxMs);
  const asked = retryAfterSeconds !== null && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? Math.ceil(retryAfterSeconds) * 1_000 : 0;
  return Math.max(paced, asked);
}

/**
 * The outcome of an answered redeem. As `outcomeOf`, with one difference: the hand-off after a
 * success counts from `now`, the store's clock when the answer landed. The answer's own `pairedAt`
 * is the Core's instant of the pairing; the time the request was out has already passed since.
 */
export function liveOutcomeOf(result: PairResult, now: EpochMs): PairOutcome {
  return result.ok ? { kind: 'paired', pairedAt: now } : outcomeOf(result);
}

/** The Core judged the code: paired, not accepted, or locked. Then the count of attempts without a judgement starts anew. */
export function isJudged(outcome: PairOutcome): boolean {
  return outcome.kind === 'paired' || outcome.kind === 'invalid' || outcome.kind === 'locked';
}

/**
 * The outcome of a redeem that was rejected (no judgement of the code), or `null` when nothing is
 * to be shown: the Live source was stopped, the screen that sent the code is gone.
 *
 * | The action rejected with | Outcome |
 * |---|---|
 * | `LiveTransportError`, status 429 | `limited`: wait `retry-after`; no attempt was counted (D116) |
 * | `LiveTransportError` `CORE_OFFLINE` without a request (the link was down), or a 503 | `unavailable` OFFLINE: the code was not checked |
 * | a request that left and got no answer (a time-out, a lost connection) | `unavailable` NO_ANSWER: whether the code was used is not known |
 * | `CoreRefusalError` `NOT_AVAILABLE` | `unavailable` STORAGE: the credential could not be stored; the runtime removed the registration |
 * | a 5xx, an answer outside the contract, any other refusal the presenter knows | `unavailable` FAILED |
 * | anything else | `error`: the screen's own generic alert, as before |
 */
export function failureOutcomeOf(error: unknown, consecutive: number, now: EpochMs): PairOutcome | null {
  const shown = describeCoreError(error);
  if (shown === null) return { kind: 'error' };
  if (shown.kind === 'STOPPED') return null;
  const exhausted = consecutive >= PAIR_RETRY.maxRetries;
  if (shown.kind === 'LIMIT') return { kind: 'limited', retryAt: now + retryWaitMs(consecutive, shown.retryAfterSeconds), exhausted };
  // The presenter words a lost connection like a link that was down ("Nothing was changed"). For a
  // redeem the difference matters: a request that left may have used the code up.
  const unanswered = shown.kind === 'TIMEOUT' || shown.kind === 'SNAPSHOT_TIMEOUT' || (error instanceof LiveTransportError && error.code === NETWORK_CODE);
  const reason = unanswered ? 'NO_ANSWER' : shown.kind === 'OFFLINE' ? 'OFFLINE' : shown.kind === 'NOT_AVAILABLE' ? 'STORAGE' : 'FAILED';
  return { kind: 'unavailable', reason, retryAt: now + retryWaitMs(consecutive, null), exhausted };
}

/** The instant the next attempt may start, or `null`: no wait is running. */
export function retryAtOf(outcome: PairOutcome | null): EpochMs | null {
  return outcome?.kind === 'limited' || outcome?.kind === 'unavailable' ? outcome.retryAt : null;
}

/**
 * The typed code stays in the slots after an outcome when the Core did not judge it and it can
 * still be redeemed. A wrong code is cleared (as before). So is a code the Core has redeemed although
 * the tablet could not keep the credential: that code is used up.
 */
export function keepsCode(outcome: PairOutcome): boolean {
  return outcome.kind === 'limited' || (outcome.kind === 'unavailable' && outcome.reason !== 'STORAGE');
}

// ---------------------------------------------------------------------------------------------
// The connection pane
// ---------------------------------------------------------------------------------------------

/** The offline notice replaces the prompt; an attempt in flight and a paired tablet keep their own view. */
function showsOffline(view: PairingView, link: LiveLinkView): boolean {
  return link === 'offline' && view !== 'pairing' && view !== 'paired';
}

/** C-4 statuses in LIVE mode: as the simulator's, and Discover in error while the Core is unreachable. */
export function liveStepStatusesFor(view: PairingView, phase: PairPhase | null, link: LiveLinkView): StepStatus[] {
  return showsOffline(view, link) ? ['error', 'pending', 'pending'] : stepStatusesFor(view, phase);
}

/** C-1 ring in LIVE mode: critical while the Core is unreachable (the Login ring's rule), else the simulator's. */
export function liveRingStateFor(view: PairingView, link: LiveLinkView): GlowRingState {
  return showsOffline(view, link) ? 'critical' : ringStateFor(view);
}

export interface LiveStatusInput {
  view: PairingView;
  phase: PairPhase | null;
  /** The code left the tablet: the request is out. */
  sent: boolean;
  link: LiveLinkView;
  outcome: PairOutcome | null;
}

/** The one status line under the stepper in LIVE mode (i18n key under `features.pairing.live.connection.status`). */
export function liveStatusKeyFor({ view, phase, sent, link, outcome }: LiveStatusInput): string {
  if (view === 'pairing') return sent ? 'sent' : phase === 'discover' ? 'discovering' : 'verifying';
  if (view === 'paired') return 'paired';
  if (link === 'offline') return 'offline';
  if (view === 'locked') return 'locked';
  if (view === 'failed') return outcome?.kind === 'invalid' ? 'failed' : 'unavailable';
  return link === 'connecting' ? 'connecting' : 'idle';
}

// ---------------------------------------------------------------------------------------------
// The notices of the gate (§9.4, §6.6)
// ---------------------------------------------------------------------------------------------

/** `revoked` and `unknown` are refusals of the Core (danger); `unpaired` reports what was asked for (info). */
export function noticeStatusFor(notice: PairingNotice): 'danger' | 'accent' {
  return notice === 'unpaired' ? 'accent' : 'danger';
}
