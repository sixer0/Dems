/**
 * The Pairing screen's controller (04_mobile_specs §4.2, §6.5): the code, the attempt in flight,
 * its outcome, the lockout countdown and the hand-off. Every timer runs on the simulator clock
 * (D58, D73 F74-09): the connection steps (Discover → Verify), the commit to `pair(code)` and the
 * hand-off after a success are store subscriptions, never `setTimeout`.
 *
 * - `pair()` starts an attempt; the code reaches the simulator only at `PAIR_TIMELINE.commitAt`,
 *   so Cancel during Discover / Verify writes no audit row. The simulator writes exactly one audit
 *   row per committed attempt (PAIRING_SUCCESS / PAIRING_FAILED / PAIRING_LOCKED) and owns the
 *   3-failure → 60 s lockout.
 * - `unpair()` calls the simulator (one UNPAIRED audit row).
 * - `leave()` hands off per the §3.3 guard: back to the screen underneath (Login, Settings) if
 *   there is one, else the boot router `/` (→ `/login` signed out, the §3.3 target signed in).
 *
 * The code lives in this hook's memory only: never stored, logged or put in an audit row (§6.1).
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PAIRING_CODE_LENGTH, useSim, useSimActions, useSimInstance, type EpochMs, type PairingState } from '@dems/shared/sim';
import { useHaptics } from '@/motion';
import { reportRuntimeIssue } from '@/runtime';
import {
  PAIR_TIMELINE,
  leaveTargetFor,
  outcomeOf,
  pairingViewFor,
  phaseAt,
  selectLockSeconds,
  selectPairingState,
  type PairOutcome,
  type PairPhase,
  type PairingView,
} from './pairing-model';

interface Attempt {
  startedAt: EpochMs;
  code: string;
}

export interface PairingFlow {
  code: string;
  setCode: (code: string) => void;
  simState: PairingState;
  view: PairingView;
  phase: PairPhase | null;
  outcome: PairOutcome | null;
  lockSeconds: number;
  /** Pair is enabled: six digits, not paired, not locked, nothing in flight. */
  canPair: boolean;
  /** The slots show the invalid outline (a rejected code, until the next digit). */
  codeInvalid: boolean;
  /** A success of this visit is about to hand off. */
  handingOff: boolean;
  pair: () => void;
  /** Aborts an attempt in flight (nothing is committed) and leaves. */
  cancel: () => void;
  leave: () => void;
  /** Unpairs; false if the simulator refused (logged). */
  unpair: () => boolean;
}

const DIGITS = /\D/g;

export function usePairingFlow(): PairingFlow {
  const sim = useSimInstance();
  const actions = useSimActions();
  const router = useRouter();
  const haptic = useHaptics();
  const simState = useSim(selectPairingState);
  const lockSeconds = useSim(selectLockSeconds);
  const [code, setCodeState] = useState('');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [outcome, setOutcome] = useState<PairOutcome | null>(null);
  const left = useRef(false);

  // The phase of the attempt in flight, from the simulator clock (a primitive: 3 renders per attempt).
  const startedAt = attempt?.startedAt ?? null;
  const phase = useSim((s) => (startedAt === null ? null : phaseAt(s.clock.now - startedAt)));
  const view = pairingViewFor({ simState, phase, lockSeconds, outcome });

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    if (leaveTargetFor(router.canGoBack()) === 'back') router.back();
    else router.replace('/');
  }, [router]);

  // Commit the code once the Verify step has run its course (simulator clock).
  useEffect(() => {
    if (attempt === null) return undefined;
    let disposed = false;
    let fired = false;
    const unsubscribe = sim.store.subscribe(
      (s) => s.clock.now - attempt.startedAt >= PAIR_TIMELINE.commitAt,
      (due) => {
        if (!due || fired) return;
        fired = true;
        // Out of the store's notify loop: the engine's tick must finish before the next write.
        queueMicrotask(() => {
          if (disposed) return;
          let next: PairOutcome;
          try {
            next = outcomeOf(actions.pair(attempt.code));
          } catch (error) {
            reportRuntimeIssue('error', 'PairingScreen.pair', error, { phase: 'commit' });
            next = { kind: 'error' };
          }
          setAttempt(null);
          setOutcome(next);
          if (next.kind !== 'paired') setCodeState('');
          haptic(next.kind === 'paired' ? 'pairingSuccess' : next.kind === 'locked' ? 'lockout' : 'signInFailure');
        });
      },
      { fireImmediately: true },
    );
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [attempt, sim, actions, haptic]);

  // Hand off after a success of this visit (simulator clock), unless the operator already left.
  const handoffAt = outcome?.kind === 'paired' && simState === 'PAIRED' ? outcome.pairedAt + PAIR_TIMELINE.handoffAfter : null;
  useEffect(() => {
    if (handoffAt === null) return undefined;
    let disposed = false;
    let fired = false;
    const unsubscribe = sim.store.subscribe(
      (s) => s.clock.now >= handoffAt,
      (due) => {
        if (!due || fired) return;
        fired = true;
        queueMicrotask(() => {
          if (!disposed) leave();
        });
      },
      { fireImmediately: true },
    );
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [handoffAt, sim, leave]);

  const setCode = useCallback((value: string) => {
    setCodeState(value.replace(DIGITS, '').slice(0, PAIRING_CODE_LENGTH));
  }, []);

  const canPair = code.length === PAIRING_CODE_LENGTH && view !== 'pairing' && view !== 'paired' && view !== 'locked';

  const pair = () => {
    if (!canPair) return;
    haptic('primaryPress');
    setOutcome(null);
    setAttempt({ startedAt: sim.store.getState().clock.now, code });
  };

  const cancel = () => {
    setAttempt(null);
    leave();
  };

  const unpair = (): boolean => {
    try {
      actions.unpair();
    } catch (error) {
      reportRuntimeIssue('error', 'PairingScreen.unpair', error);
      return false;
    }
    left.current = false;
    setOutcome(null);
    setCodeState('');
    return true;
  };

  return {
    code,
    setCode,
    simState,
    view,
    phase,
    outcome,
    lockSeconds,
    canPair,
    codeInvalid: view === 'failed' && code.length === 0,
    handingOff: handoffAt !== null,
    pair,
    cancel,
    leave,
    unpair,
  };
}
