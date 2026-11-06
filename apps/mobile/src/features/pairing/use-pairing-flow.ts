/**
 * The Pairing screen's controller (04_mobile_specs §4.2, §6.5): the code, the attempt in flight,
 * its outcome, the lockout countdown and the hand-off. Every timer runs on the clock of the store
 * (D58, D73 F74-09): the connection steps (Discover → Verify), the commit to `pair(code)` and the
 * hand-off after a success are store subscriptions, never `setTimeout`.
 *
 * - `pair()` starts an attempt; the code reaches the Core only at `PAIR_TIMELINE.commitAt`, so
 *   Cancel during Discover / Verify writes no audit row and, in Live mode, sends no request. The
 *   Core writes exactly one audit row per committed attempt (PAIRING_SUCCESS / PAIRING_FAILED /
 *   PAIRING_LOCKED) and owns the 3-failure → 60 s lockout.
 * - `unpair()` calls the Core (one UNPAIRED audit row).
 * - `leave()` hands off per the §3.3 guard (`leaveTargetFor`): Cancel goes back to the screen
 *   underneath (Login, Settings) if there is one, else to the boot router `/`. The hand-off after a
 *   success goes back to Settings when an operator is signed in; signed out it resets the stack to the
 *   boot router, which opens Login, whatever deep links had pushed underneath (row FX-M1, E2E-S-1).
 *
 * The code lives in this hook's memory only: never stored, logged or put in an audit row (§6.1).
 *
 * **Both data modes** (backend task W57; 04_client_integration_spec §9.4, MP-5 to MP-8). The
 * actions come from `useCoreActions()` and are consumed through `settle`, so one call site serves
 * the simulator (it answers before `settle` returns: the timing of Simulated mode is as it was)
 * and the Live source (it answers when the Core server did). What Live mode adds:
 *
 * | Point | Rule |
 * |---|---|
 * | One attempt, one request | An attempt object is sent at most once, whatever React does to the effect that commits it |
 * | Cancel | Enabled until the request is out, then disabled: a request that left cannot be taken back. While the pairing gate holds there is no screen to leave to, so Cancel only ends the attempt |
 * | The credential | Written to secure storage by the runtime BEFORE the action settles (MP-6); this hook never sees it |
 * | The link | The code is sent while the Live link is ONLINE only; the screen shows "Core server unreachable" otherwise |
 * | No judgement of the code | A 429, no answer, a 5xx, a failed storage: drawn in place, with a paced Retry (`pairing-live-model`) |
 * | Unpair | Refused while the link is down, and nothing is deleted then (MP-7) |
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { settle, useCoreActions } from '@dems/shared/live';
import { useRetryCooldown, type RetryCooldown } from '@dems/shared/realtime';
import { PAIRING_CODE_LENGTH, useSim, useSimInstance, type EpochMs, type PairingState } from '@dems/shared/sim';
import { useHaptics } from '@/motion';
import {
  isCoreLinkSourceAvailable,
  isPairingBlocked,
  reportRuntimeIssue,
  resetToBootRouter,
  setCoreLinkSource,
  useAuth,
  useCoreLink,
  useMobileLive,
  useNoticeLiveLink,
  usePairing,
  type PairingNotice,
} from '@/runtime';
import {
  failureOutcomeOf,
  isJudged,
  keepsCode,
  liveLinkViewFor,
  liveOutcomeOf,
  offlineNoticeAfter,
  retryAtOf,
  type LiveLinkView,
} from './pairing-live-model';
import {
  PAIR_TIMELINE,
  leaveTargetFor,
  lockSecondsAt,
  outcomeOf,
  pairingViewFor,
  phaseAt,
  selectLockSeconds,
  selectPairingState,
  type LeaveReason,
  type PairOutcome,
  type PairPhase,
  type PairingView,
} from './pairing-model';

interface Attempt {
  startedAt: EpochMs;
  code: string;
}

/** What `unpair` tells its caller: exactly one of the two runs, once. */
export interface UnpairHandlers {
  ok: () => void;
  /** The Core refused, or could not be reached; nothing was deleted. `error` is the rejection itself. */
  fail: (error: unknown) => void;
}

export interface PairingFlow {
  code: string;
  setCode: (code: string) => void;
  simState: PairingState;
  view: PairingView;
  phase: PairPhase | null;
  outcome: PairOutcome | null;
  lockSeconds: number;
  /** Pair is enabled: six digits, not paired, not locked, nothing in flight; in Live mode also the link up and no wait running. */
  canPair: boolean;
  /** The slots show the invalid outline (a rejected code, until the next digit). */
  codeInvalid: boolean;
  /** A success of this visit is about to hand off. */
  handingOff: boolean;
  pair: () => void;
  /** Aborts an attempt in flight (nothing is committed) and leaves. Does nothing once the request is out. */
  cancel: () => void;
  /** Leaves the screen; `reason` defaults to `cancel` (the header's back, Cancel). */
  leave: (reason?: LeaveReason) => void;
  /** Unpairs. The simulator answers before this returns; the Core server answers later. */
  unpair: (handlers: UnpairHandlers) => void;

  // ── Live mode (all neutral in Simulated mode) ──
  /** The Core link source is LIVE: the Core server is the Core. */
  live: boolean;
  /** How the screen words the Live link; `null` in Simulated mode. */
  link: LiveLinkView | null;
  /** The code left the tablet and the answer is not in yet. */
  sent: boolean;
  /** The pairing gate holds (MP-11): there is no screen to go back to. */
  blocked: boolean;
  /** The gate's notice, until the next attempt of this visit. */
  notice: PairingNotice | null;
  /** The Core's ID of this tablet while paired, e.g. `DEV-0003`. */
  tabletId: string | null;
  /** Whole seconds until the next attempt may start after one that got no judgement (0 = none). */
  retrySeconds: number;
  /** The Retry of the error form is offered: the code is still in the slots and the three paced retries are not used up. */
  retryOffered: boolean;
  /** The Retry of the offline notice: asks the Live socket to reconnect now (3 s, 6 s, 12 s; three times). */
  coreRetry: RetryCooldown;
  /**
   * "Use Simulated mode" may be offered: LIVE mode, and this build allows a simulated link. That is
   * the dev-build gate of `core-link.ts` (`isCoreLinkSourceAvailable`: `isDevBuild` and
   * `KNOWN_CORE_LINK_SOURCES`, register L5, RT-1, D163). A release build answers `false`, so the
   * tablet stays LIVE-only from pairing through login (row 223, D174, D58).
   */
  simulatedOffered: boolean;
  /** Debug builds: back to the simulator (the choice is stored), then the boot router. A release build refuses it and stays. */
  switchToSimulated: () => void;
}

const DIGITS = /\D/g;

export function usePairingFlow(): PairingFlow {
  const sim = useSimInstance();
  const actions = useCoreActions();
  const router = useRouter();
  const haptic = useHaptics();
  const live = useCoreLink().source === 'LIVE';
  // The Live link as the notice reads it: a run the Core ended on purpose (the 4403 of a revocation)
  // is the app's own reconnect, not "Core server unreachable" (E2E-S-3, `@/runtime` `ended-link`).
  const liveLink = useNoticeLiveLink();
  const { isAuthenticated } = useAuth();
  const gate = usePairing();
  const mobileLive = useMobileLive();
  const simState = useSim(selectPairingState);
  const lockSeconds = useSim(selectLockSeconds);
  const [code, setCodeState] = useState('');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [outcome, setOutcome] = useState<PairOutcome | null>(null);
  const [sent, setSent] = useState(false);
  const left = useRef(false);
  /** The attempt whose request is out. One attempt is sent at most once. */
  const flight = useRef<Attempt | null>(null);
  /** Attempts in a row that got no judgement of the code (the pacing of Retry). */
  const unjudged = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The offline notice follows the Live link; CONNECTING is a transient that keeps what is shown
  // ("adjusting state when a prop changes": no effect, no extra commit).
  const [linkSeen, setLinkSeen] = useState(liveLink);
  const [offlineShown, setOfflineShown] = useState(() => offlineNoticeAfter(false, liveLink));
  if (linkSeen !== liveLink) {
    setLinkSeen(liveLink);
    setOfflineShown(offlineNoticeAfter(offlineShown, liveLink));
  }
  const link = live ? liveLinkViewFor(liveLink, offlineShown) : null;

  // The gate's notice is shown until the next attempt of this visit; a new notice shows again.
  const [noticeSeen, setNoticeSeen] = useState(gate.notice);
  const [noticeOpen, setNoticeOpen] = useState(true);
  if (noticeSeen !== gate.notice) {
    setNoticeSeen(gate.notice);
    setNoticeOpen(true);
  }

  // The phase of the attempt in flight, from the store's clock (a primitive: 3 renders per attempt).
  const startedAt = attempt?.startedAt ?? null;
  const phase = useSim((s) => (startedAt === null ? null : phaseAt(s.clock.now - startedAt)));
  const view = pairingViewFor({ simState, phase, lockSeconds, outcome });
  const retryAt = retryAtOf(outcome);
  const retrySeconds = useSim((s) => lockSecondsAt(retryAt, s.clock.now));
  const blocked = isPairingBlocked(gate);

  const leave = useCallback(
    (reason: LeaveReason = 'cancel') => {
      if (left.current) return;
      left.current = true;
      const target = leaveTargetFor(router.canGoBack(), reason, isAuthenticated);
      if (target === 'back') router.back();
      // The signed-out hand-off resets the stack (E2E-S-1); Cancel without a screen underneath replaces this one.
      else if (reason === 'handoff') resetToBootRouter(router);
      else router.replace('/');
    },
    [router, isAuthenticated],
  );

  /** Sends the code of `sending` to the Core, once, and takes the answer. */
  const commit = useCallback(
    (sending: Attempt) => {
      if (flight.current === sending) return;
      flight.current = sending;
      if (live) setSent(true);
      const land = (next: PairOutcome | null) => {
        // An answer for an attempt that is no longer this screen's changes nothing here. In Live
        // mode the runtime has stored the credential by then, whatever becomes of this screen (MP-6).
        if (flight.current !== sending) return;
        flight.current = null;
        if (!mounted.current) return;
        setAttempt(null);
        setSent(false);
        setOutcome(next);
        if (next === null) return;
        if (isJudged(next)) unjudged.current = 0;
        // A refused code is cleared, as before. Live mode also drops a redeemed code: it is used up,
        // and nothing of this screen needs it again.
        if (next.kind === 'paired' ? live : !keepsCode(next)) setCodeState('');
        haptic(next.kind === 'paired' ? 'pairingSuccess' : next.kind === 'locked' ? 'lockout' : next.kind === 'limited' ? 'gateWarn' : 'signInFailure');
      };
      settle(() => actions.pair(sending.code), {
        ok: (result) => land(live ? liveOutcomeOf(result, sim.store.getState().clock.now) : outcomeOf(result)),
        fail: (error) => {
          if (!live) {
            reportRuntimeIssue('error', 'PairingScreen.pair', error, { phase: 'commit' });
            land({ kind: 'error' });
            return;
          }
          unjudged.current += 1;
          const next = failureOutcomeOf(error, unjudged.current, sim.store.getState().clock.now);
          // The Live source has reported the rejection itself (CL-24). This line names the screen's
          // reading of it; an error's text never holds the code.
          reportRuntimeIssue(next?.kind === 'error' ? 'error' : 'warn', 'PairingScreen.pair', error, {
            phase: 'commit',
            outcome: next?.kind ?? 'stopped',
            reason: next?.kind === 'unavailable' ? next.reason : null,
            attemptsWithoutAnswer: unjudged.current,
          });
          land(next);
        },
      });
    },
    [actions, haptic, live, sim],
  );

  // Commit the code once the Verify step has run its course (the store's clock).
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
          commit(attempt);
        });
      },
      { fireImmediately: true },
    );
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [attempt, sim, commit]);

  // Hand off after a success of this visit (the store's clock), unless the operator already left.
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
          if (!disposed) leave('handoff');
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
    // A code the operator edits is a new, deliberate attempt: the pacing of Retry starts anew.
    unjudged.current = 0;
    setCodeState(value.replace(DIGITS, '').slice(0, PAIRING_CODE_LENGTH));
  }, []);

  const canPair =
    code.length === PAIRING_CODE_LENGTH &&
    view !== 'pairing' &&
    view !== 'paired' &&
    view !== 'locked' &&
    (!live || (link === 'online' && retrySeconds === 0));

  const pair = () => {
    if (!canPair) return;
    haptic('primaryPress');
    setOutcome(null);
    setNoticeOpen(false);
    setAttempt({ startedAt: sim.store.getState().clock.now, code });
  };

  const cancel = () => {
    // A request that left the tablet cannot be taken back: the answer decides.
    if (sent) return;
    setAttempt(null);
    // While the gate holds there is nowhere to leave to: the attempt ends, the screen stays.
    if (!blocked) leave();
  };

  const unpair = (handlers: UnpairHandlers) => {
    settle(() => actions.unpair(), {
      ok: () => {
        left.current = false;
        setOutcome(null);
        setCodeState('');
        handlers.ok();
      },
      fail: (error) => {
        // Live mode: a refusal while the link is down is an expected state, not a fault.
        reportRuntimeIssue(live ? 'warn' : 'error', 'PairingScreen.unpair', error);
        handlers.fail(error);
      },
    });
  };

  const reconnect = useCallback(() => {
    try {
      mobileLive?.reconnect('RETRY');
    } catch (error) {
      reportRuntimeIssue('warn', 'PairingScreen.reconnect', error);
    }
  }, [mobileLive]);
  const coreRetry = useRetryCooldown(reconnect);

  // Read at render, like the setter reads it at call time: the gate follows the build flag.
  const simulatedOffered = live && isCoreLinkSourceAvailable('SIMULATED');

  const switchToSimulated = () => {
    // Row 223 (D174): never a way out of LIVE in a release build, whatever calls this.
    if (!isCoreLinkSourceAvailable('SIMULATED')) {
      reportRuntimeIssue('warn', 'PairingScreen.useSimulated', 'Use Simulated mode refused: this build allows LIVE only');
      return;
    }
    reportRuntimeIssue('info', 'PairingScreen.useSimulated', 'Core link source set to SIMULATED from the Pair screen');
    setAttempt(null);
    setCoreLinkSource('SIMULATED');
    // The runtime mounts the simulator in place of the Live source; the boot router picks the screen.
    router.replace('/');
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
    live,
    link,
    sent,
    blocked,
    notice: live && noticeOpen && view !== 'paired' ? gate.notice : null,
    tabletId: live ? gate.deviceId : null,
    retrySeconds,
    retryOffered: outcome !== null && (outcome.kind === 'limited' || outcome.kind === 'unavailable') && keepsCode(outcome) && !outcome.exhausted,
    coreRetry,
    simulatedOffered,
    switchToSimulated,
  };
}
