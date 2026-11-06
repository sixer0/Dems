/**
 * State and commands of the camera search (task 3, blueprint row 138; ux spec §8c flow 9).
 *
 * | Rule | How |
 * |---|---|
 * | A search starts only on a press (R-9 AC-1) | `start()` is the one caller of operation 93; no effect, timer or read starts one |
 * | Entry read (§8c.1 "Read on entry") | operation 94 once when the screen gains focus and the gate lets the caller read; it restores the caller's own result after a navigation |
 * | A role without `CAPTURE_CONFIG` requests NO list (S13; check `M4-DISC-RBAC-T` / `-P`) | `read()` returns before the port while the gate is `checking`, `waiting` or `denied` |
 * | Bounded search (S3) | while operation 94 answers `RUNNING` it is read again no faster than once per second; the bar is `(Core now − startedAt) / windowMs`, forward-only; the END is operation 94's answer, never the bar or a client clock (§8c.8) |
 * | No countdown, no automatic search (R-10 AC-4) | a `429` keeps its fixed seconds and one timer re-enables the button at that instant; nothing is retried by itself |
 * | The result lives in this component's state only (§8c.4) | no storage, no slice, no query cache; leaving the screen drops it and the next entry read restores it from the Core |
 * | A refusal is drawn in place, and logged | `note` holds the class; `reportRuntimeIssue` writes one record with the class and the status only (no address, no device text) |
 *
 * `CameraSearchProvider` shares ONE search between the panel, the notifications and the selector's
 * empty state of a screen, so "Search again" anywhere on that screen is the same control (G13).
 */
import { useIsFocused } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CaptureDiscoveryStateBody } from '@dems/shared/api';
import { Permission, hasActiveSession, useSim, useSimInstance } from '@dems/shared/sim';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import { coreClockOf, reportRuntimeIssue, useCoreLinkNotice, useMobileLive } from '@/runtime';
import {
  SEARCH_POLL_MS,
  SEARCH_PROGRESS_TICK_MS,
  candidateGroups,
  candidateRows,
  classifySearchAnswer,
  discoveryStateOf,
  isDrawnResult,
  isExpectedSearchRefusal,
  searchGate,
  searchPanelState,
  searchProgress,
  type CandidateGroups,
  type CandidateRow,
  type SearchAnswerClass,
  type SearchGateState,
  type SearchPanelState,
} from './camera-search-model';
import { liveDiscoveryPort, simDiscoveryPort, type DiscoveryPort } from './capture-discovery-port';

/** A refusal of operation 93 that is drawn as a note beside the button (S9, S10) or as a failure line. */
export type SearchNote = 'busy' | 'unavailable' | 'signedOut' | 'offline';

export interface CameraSearch {
  readonly gate: SearchGateState;
  /** Why the Search button is disabled, as a sentence; null when the gate is open. */
  readonly gateHint: string | null;
  readonly state: SearchPanelState;
  /** Operation 94's last answer; null before the first. */
  readonly view: CaptureDiscoveryStateBody | null;
  readonly groups: CandidateGroups;
  /** Every row of a drawn result, in the order operation 94 answered. */
  readonly rows: readonly CandidateRow[];
  /** 0..100 while `searching`; it only grows. */
  readonly progress: number;
  /** Operation 93 is out. */
  readonly starting: boolean;
  readonly note: SearchNote | null;
  /** The fixed seconds of a `429`, or null; while set the button is disabled. `0` = no time was sent. */
  readonly limitedSeconds: number | null;
  /** The button may be pressed now. */
  readonly canSearch: boolean;
  /** The data is a Core server's (Live mode). */
  readonly live: boolean;
  /** Operation 93, then operation 94. Never rejects. */
  start(): void;
  /** Operation 94, when the gate lets the caller read. Never rejects. */
  refresh(): void;
}

export function useCameraSearchController(): CameraSearch {
  const { t } = useTranslation();
  const sim = useSimInstance();
  const live = useMobileLive();
  const role = useRoleGate(Permission.CAPTURE_CONFIG);
  const link = useCoreLinkNotice();
  const recording = useSim((s) => s.session?.state === 'RECORDING');
  const sessionOpen = useSim(hasActiveSession);
  const sessionId = useSim((s) => s.session?.id ?? null);

  const port = useMemo<DiscoveryPort>(() => (live === null ? simDiscoveryPort(sim) : liveDiscoveryPort(live.client)), [live, sim]);

  const [view, setView] = useState<CaptureDiscoveryStateBody | null>(null);
  const [read, setRead] = useState(false);
  const [hadResult, setHadResult] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [note, setNote] = useState<SearchNote | null>(null);
  const [starting, setStarting] = useState(false);
  const [limitedSeconds, setLimitedSeconds] = useState<number | null>(null);
  /** The session during which the Core answered `409 DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`; S14 lasts as long as that session is open. */
  const [refusedInSession, setRefusedInSession] = useState<string | null>(null);
  const refusedWhileRecording = refusedInSession !== null && refusedInSession === sessionId;
  const [progress, setProgress] = useState(0);
  const mounted = useRef(true);
  const reading = useRef(false);
  const startOut = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const gate = searchGate({ roleKnown: role.known, permitted: role.allowed, linkDown: link.offline, recording, refusedWhileRecording: refusedWhileRecording && sessionOpen });
  const mayRead = gate === 'allowed' || gate === 'recording';

  const log = useCallback((operation: 'start' | 'read', result: SearchAnswerClass, status: number | null) => {
    reportRuntimeIssue(isExpectedSearchRefusal(result) ? 'warn' : 'error', 'devices.cameraSearch', `camera search ${operation} -> ${result}`, { operation, result, status });
  }, []);

  const readNow = useCallback(async (): Promise<void> => {
    if (reading.current) return;
    reading.current = true;
    const answer = await port.read();
    reading.current = false;
    if (!mounted.current) return;
    const result = classifySearchAnswer(answer.facts);
    const body = result === 'ok' ? discoveryStateOf(answer.body) : null;
    if (body === null) {
      // 403 is the gate's own state (S13); anything else is "could not be completed" (S8).
      if (result !== 'denied') {
        log('read', result === 'ok' ? 'failed' : result, answer.facts.status);
        setReadFailed(true);
        setNote(result === 'offline' || result === 'signedOut' ? result : null);
      }
      return;
    }
    setReadFailed(false);
    setRead(true);
    setView(body);
    if (body.search !== null && body.search.state === 'COMPLETE') setHadResult(true);
  }, [log, port]);

  const refresh = useCallback(() => {
    if (!mayRead) return;
    void readNow();
  }, [mayRead, readNow]);

  // §8c.1 "Read on entry" and §8c.4 "Expiry: detected by the next read (on focus, on entering the screen)".
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    // The read is asynchronous by nature (a request); it is started after the commit, never inside it.
    void Promise.resolve().then(refresh);
  }, [focused, refresh]);

  const start = useCallback(() => {
    if (startOut.current || gate !== 'allowed' || limitedSeconds !== null) return;
    startOut.current = true;
    setStarting(true);
    setNote(null);
    void port.start().then(async (answer) => {
      const result = classifySearchAnswer(answer.facts);
      if (result !== 'ok') log('start', result, answer.facts.status);
      if (mounted.current) {
        switch (result) {
          case 'ok':
            // The new search replaces the list the moment it is accepted (§8c.4 "Search again").
            setHadResult(false);
            setReadFailed(false);
            setProgress(0);
            break;
          case 'busy':
          case 'unavailable':
          case 'signedOut':
            setNote(result);
            break;
          case 'recording':
            setRefusedInSession(sessionId);
            break;
          case 'limited':
            setLimitedSeconds(answer.facts.retryAfterS ?? 0);
            break;
          case 'denied':
            // The gate words it once the role is known; nothing else is drawn.
            break;
          case 'offline':
          case 'failed':
            setReadFailed(true);
            setNote(result === 'offline' ? 'offline' : null);
            break;
        }
      }
      if (result === 'ok') await readNow();
      startOut.current = false;
      if (mounted.current) setStarting(false);
    });
  }, [gate, limitedSeconds, log, port, readNow, sessionId]);

  // S11: the button re-enables by itself at the instant the Core named; no label ticks.
  useEffect(() => {
    if (limitedSeconds === null) return undefined;
    const timer = setTimeout(() => setLimitedSeconds(null), Math.max(1, limitedSeconds) * 1000);
    return () => clearTimeout(timer);
  }, [limitedSeconds]);

  // S3: the bar from Core instants, and operation 94 no faster than once per second.
  const running = view?.search?.state === 'RUNNING' ? view.search : null;
  const runningKey = running === null ? null : `${running.searchId}:${running.startedAt}:${running.windowMs}`;
  useEffect(() => {
    if (running === null) return undefined;
    const coreNow = (): number => coreClockOf(sim)?.now() ?? sim.store.getState().clock.now;
    let sinceRead = 0;
    const timer = setInterval(() => {
      setProgress((previous) => searchProgress(running, coreNow(), previous));
      sinceRead += SEARCH_PROGRESS_TICK_MS;
      if (sinceRead >= SEARCH_POLL_MS) {
        sinceRead = 0;
        void readNow();
      }
    }, SEARCH_PROGRESS_TICK_MS);
    return () => clearInterval(timer);
    // `runningKey` names the search; the object itself changes with every read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningKey, readNow, sim]);

  const state = searchPanelState({ gate, read, view, hadResult, readFailed });
  const drawn = isDrawnResult(state);
  const groups = useMemo(() => candidateGroups(drawn && view !== null ? view.candidates : []), [drawn, view]);
  const rows = useMemo(() => candidateRows(drawn && view !== null ? view.candidates : []), [drawn, view]);

  const gateHint =
    gate === 'checking'
      ? (role.hint ?? t('mobile.rbac.checking'))
      : gate === 'waiting'
        ? t('features.capture-selector.search.waiting')
        : gate === 'denied'
          ? t('features.capture-selector.search.denied', { first: t('common.roles.SUPERVISOR'), second: t('common.roles.TECHNICIAN') })
          : gate === 'recording'
            ? t('features.capture-selector.search.recordingLocked')
            : null;

  return {
    gate,
    gateHint,
    state,
    view,
    groups,
    rows,
    progress,
    starting,
    note,
    limitedSeconds,
    canSearch: gate === 'allowed' && !starting && limitedSeconds === null && state !== 'searching',
    live: live !== null,
    start,
    refresh,
  };
}

const CameraSearchContext = createContext<CameraSearch | null>(null);

/** One camera search for everything below it (the panel, the notifications, the selector's empty state). */
export function CameraSearchProvider({ children }: { children?: ReactNode }) {
  const search = useCameraSearchController();
  return <CameraSearchContext.Provider value={search}>{children}</CameraSearchContext.Provider>;
}

/** The search of the screen, or null on a surface that mounts no panel (Settings → Capture). */
export function useCameraSearch(): CameraSearch | null {
  return useContext(CameraSearchContext);
}
