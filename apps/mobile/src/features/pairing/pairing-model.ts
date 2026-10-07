/**
 * Pairing screen model (04_mobile_specs §4.2, §6.5; book §20.1). Pure: the connection-steps
 * timeline on the simulator clock, the view state, the C-4 statuses, the C-1 ring state and the
 * flat `useSim` selectors (F74-13: primitives or flat tuples only).
 *
 * The pairing policy itself (the demo code, 3 failures in 5 min → 60 s lockout, the audit rows
 * PAIRING_SUCCESS / PAIRING_FAILED / PAIRING_LOCKED / UNPAIRED) belongs to the shared simulator
 * (`packages/shared/src/sim/pairing.ts`); this module never sees or stores a code.
 */
import { AUDIT_TYPE_CATEGORY, PairingState, type AuditType, type EpochMs, type PairResult, type SimState } from '@dems/shared/sim';
import type { GlowRingState } from '@/components/composed/glow-ring.math';
import type { StepStatus } from '@/components/composed/stepper';

// ---------------------------------------------------------------------------------------------
// Timeline (simulator clock, D58/D73 F74-09)
// ---------------------------------------------------------------------------------------------

/**
 * The connection steps after Pair is pressed, in simulator milliseconds: Discover runs first, then
 * Verify (code + certificate, DEMO); the code goes to the simulator at `commitAt`, so a Cancel
 * before that writes nothing. A successful pairing hands off `handoffAfter` after it lands.
 */
export const PAIR_TIMELINE = { verifyAt: 900, commitAt: 1_800, handoffAfter: 2_400 } as const;

export type PairPhase = 'discover' | 'verify' | 'commit';

/** Phase of an attempt `elapsedMs` after Pair was pressed (negative counts as just started). */
export function phaseAt(elapsedMs: number): PairPhase {
  if (elapsedMs >= PAIR_TIMELINE.commitAt) return 'commit';
  if (elapsedMs >= PAIR_TIMELINE.verifyAt) return 'verify';
  return 'discover';
}

// ---------------------------------------------------------------------------------------------
// Outcome and view
// ---------------------------------------------------------------------------------------------

/**
 * Live mode: why a redeem got no judgement of the code (backend task W57; 04_client_integration_spec
 * §9.4 "failed, error form"). OFFLINE: the Core did not check the code (the link was down and
 * nothing was sent, or the Core said it is not ready). NO_ANSWER: the request left and no answer
 * came, so whether the code was used is not known. FAILED: a 5xx, an answer outside the contract,
 * or a refusal that is not about the code. STORAGE: the Core paired the tablet and the tablet
 * could not keep its credential.
 */
export type PairUnavailableReason = 'OFFLINE' | 'NO_ANSWER' | 'FAILED' | 'STORAGE';

/**
 * What the last attempt of this visit returned (never the code). `limited` and `unavailable` exist
 * in Live mode only: the simulator always judges the code. `retryAt` is on the clock of the store.
 */
export type PairOutcome =
  | { kind: 'paired'; pairedAt: EpochMs }
  | { kind: 'invalid'; attemptsRemaining: number }
  | { kind: 'locked' }
  | { kind: 'error' }
  /** The Core answered 429: a limit ("wait `retry-after`"), never a wrong code. No attempt was counted. */
  | { kind: 'limited'; retryAt: EpochMs; exhausted: boolean }
  | { kind: 'unavailable'; reason: PairUnavailableReason; retryAt: EpochMs; exhausted: boolean };

export function outcomeOf(result: PairResult): PairOutcome {
  if (result.ok) return { kind: 'paired', pairedAt: result.pairedAt };
  if (result.reason === 'LOCKED') return { kind: 'locked' };
  return { kind: 'invalid', attemptsRemaining: result.attemptsRemaining };
}

/** §4.2 states (UNPAIRED, PAIRING, PAIRED, FAILED) plus the lockout as its own view. */
export type PairingView = 'unpaired' | 'pairing' | 'paired' | 'failed' | 'locked';

export interface PairingViewInput {
  simState: PairingState;
  /** Phase of the attempt in flight, or null. */
  phase: PairPhase | null;
  /** Seconds left in the lockout (0 = not locked). */
  lockSeconds: number;
  outcome: PairOutcome | null;
}

export function pairingViewFor({ simState, phase, lockSeconds, outcome }: PairingViewInput): PairingView {
  if (phase !== null) return 'pairing';
  if (simState === PairingState.PAIRED) return 'paired';
  if (lockSeconds > 0) return 'locked';
  if (outcome?.kind === 'invalid' || outcome?.kind === 'error' || outcome?.kind === 'limited' || outcome?.kind === 'unavailable') return 'failed';
  return 'unpaired';
}

/** C-4 statuses for Discover → Verify code → Paired. */
export function stepStatusesFor(view: PairingView, phase: PairPhase | null): StepStatus[] {
  switch (view) {
    case 'pairing':
      return phase === 'discover' ? ['running', 'pending', 'pending'] : ['done', 'running', 'pending'];
    case 'paired':
      return ['done', 'done', 'done'];
    case 'failed':
      return ['done', 'error', 'pending'];
    case 'locked':
      return ['done', 'warn', 'pending'];
    default:
      return ['active', 'pending', 'pending'];
  }
}

/** C-1 ring: gold while ready or in flight, green once paired, amber unpaired, red while locked. */
export function ringStateFor(view: PairingView): GlowRingState {
  switch (view) {
    case 'paired':
      return 'ready';
    case 'locked':
      return 'critical';
    case 'pairing':
      return 'ready';
    default:
      return 'attention';
  }
}

/** The one status line under the stepper (i18n key under `features.pairing.connection.status`). */
export function statusKeyFor(view: PairingView, phase: PairPhase | null): string {
  switch (view) {
    case 'pairing':
      return phase === 'discover' ? 'discovering' : 'verifying';
    case 'paired':
      return 'paired';
    case 'failed':
      return 'failed';
    case 'locked':
      return 'locked';
    default:
      return 'idle';
  }
}

/** The state chip: the simulator's state, shown as PAIRING while an attempt is in flight. */
export function stateChipFor(view: PairingView, simState: PairingState): { key: string; tone: 'success' | 'warning' | 'danger' | 'accent' } {
  if (view === 'pairing') return { key: 'mobile.pairing.state.PAIRING', tone: 'accent' };
  if (simState === PairingState.PAIRED) return { key: 'common.pairingState.PAIRED', tone: 'success' };
  if (simState === PairingState.FAILED) return { key: 'common.pairingState.FAILED', tone: view === 'locked' ? 'danger' : 'warning' };
  return { key: 'common.pairingState.UNPAIRED', tone: 'warning' };
}

// ---------------------------------------------------------------------------------------------
// Selectors (flat, F74-13)
// ---------------------------------------------------------------------------------------------

export const selectPairingState = (s: SimState): PairingState => s.pairing.state;
export const selectCoreDeviceId = (s: SimState): string => s.pairing.coreDeviceId;
export const selectCoreName = (s: SimState): string => s.pairing.coreName;
export const selectCertificateFingerprint = (s: SimState): string => s.pairing.certificateFingerprint;
export const selectPairedAt = (s: SimState): EpochMs | null => s.pairing.pairedAt;

/** Whole seconds left in a lockout on the simulator clock (0 when not locked). */
export function lockSecondsAt(lockedUntil: EpochMs | null, now: EpochMs): number {
  if (lockedUntil === null || now >= lockedUntil) return 0;
  return Math.ceil((lockedUntil - now) / 1_000);
}

export const selectLockSeconds = (s: SimState): number => lockSecondsAt(s.pairing.lockedUntil, s.clock.now);

/** The newest PAIRING audit row as a flat tuple `[seq, type, at]`, or null. */
export type PairingAuditTuple = readonly [number, AuditType, EpochMs];

export function selectLastPairingAudit(s: SimState): PairingAuditTuple | null {
  const rows = s.audit.rows;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row && AUDIT_TYPE_CATEGORY[row.type] === 'PAIRING') return [row.seq, row.type, row.at];
  }
  return null;
}

/** The fingerprint in two lines of eight byte pairs (readable in mono on a phone). */
export function fingerprintLines(fingerprint: string): string[] {
  const bytes = fingerprint.split(':');
  if (bytes.length <= 8) return [fingerprint];
  const half = Math.ceil(bytes.length / 2);
  return [bytes.slice(0, half).join(':'), bytes.slice(half).join(':')];
}

/** Where the screen goes when it is done (hand-off) or cancelled, per the §3.3 guard. */
export type LeaveTarget = 'back' | 'boot';

/** Why the screen is left: the hand-off after a success of this visit, or Cancel / the header's back. */
export type LeaveReason = 'handoff' | 'cancel';

/**
 * Where the screen goes when it is left (row FX-M1, defect E2E-S-1 of the end-to-end round, D201).
 *
 * | Reason | Signed in | Target |
 * |---|---|---|
 * | `cancel` | any | back to the screen underneath (Login, Settings) if there is one, else the boot router `/` |
 * | `handoff` | yes | the same: back to Settings, from where the operator came |
 * | `handoff` | no | the boot router `/`, which now opens Login: the stack is reset, nothing visited before stays |
 *
 * The signed-out hand-off never goes back. On the phone of E2E-S-1 deep links had pushed Stack Check
 * under the Pair screen, so "back" after a redeem landed on Stack Check, twice, and Login was never
 * reached by itself. Whatever was underneath, Login is where a paired, signed-out tablet goes.
 */
export function leaveTargetFor(canGoBack: boolean, reason: LeaveReason = 'cancel', signedIn = false): LeaveTarget {
  if (reason === 'handoff' && !signedIn) return 'boot';
  return canGoBack ? 'back' : 'boot';
}
