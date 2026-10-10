/**
 * Data and commands of the device selector (task 3, blueprint row 68; ux spec §2 flow 1).
 *
 * | Rule | How |
 * |---|---|
 * | Reads are the two replicated slices (§2.6 "replicated slices via `useSim`") | `useSim((s) => s.captureConfig)`, `useSim((s) => s.captureDevices)`: store-owned references, so a meter frame or a health tick re-renders nothing here (D73 F74-13). Never `AdminResource.DEVICES` (E-04, R-1 AC-3) |
 * | The gate of G1-G3 is one function (`selectorGate`) | the role from `useRoleGate(CAPTURE_CONFIG)` (unknown role = "Checking your permissions…", W93-11), the link from `useCoreLinkNotice`, the lock from the slice's `locked` or the store's own open session |
 * | Optimistic-free (§2.2 step 4) | nothing is written locally; a row is pending while its command is out, and after a 200 until the store's `captureConfig.updatedAt` reaches the answer's (`isAwaitingRepublish`) |
 * | No client countdown decides a state (§2.7) | the only timer is the Retry cooldown of a `503` (3 s, 6 s, 12 s; three retries), a UI rate limit that reads no Core time |
 * | A refusal is drawn in place, and logged | `notice` holds the refusal class and the row; `reportRuntimeIssue` writes one record to the persistent runtime log with ids, the class and the status only |
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Permission, hasActiveSession, useSim, useSimInstance } from '@dems/shared/sim';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import { reportRuntimeIssue, useCoreLinkNotice, useMobileLive, useRuntimeStatus } from '@/runtime';
import {
  cameraOptions,
  cameraRows,
  isAwaitingRepublish,
  isExpectedRefusal,
  isNoChange,
  isSelectorEmpty,
  micRows,
  selectorGate,
  type AnswerClass,
  type CameraOption,
  type CameraSelectorRow,
  type MicSelectorRow,
  type SelectorCommand,
  type SelectorGateState,
} from './capture-selector-model';
import { liveSelectorPort, simSelectorPort, type SelectorPort } from './capture-selector-port';
import { PANEL_MAX_RETRIES, panelRetryCooldownMs } from '@/features/devices/panel-boundary';

/** The row a command edits: the camera's track, or the one microphone field. */
export function rowKeyOf(command: SelectorCommand): string {
  return command.kind === 'camera' ? command.trackId : 'MIC';
}

export interface SelectorNotice {
  /** The refusal class (never `ok`). */
  readonly result: Exclude<AnswerClass, 'ok'>;
  readonly rowKey: string;
}

export interface SelectorRetry {
  /** Retry may be pressed now. */
  readonly canRetry: boolean;
  /** Seconds left of the cooldown; 0 when none. */
  readonly cooldownS: number;
  /** Three retries were used. */
  readonly exhausted: boolean;
  run(): void;
}

export interface CaptureSelector {
  /** The runtime has hydrated: before that the card shows its skeleton. */
  readonly ready: boolean;
  readonly empty: boolean;
  readonly cameras: readonly CameraSelectorRow[];
  readonly mics: readonly MicSelectorRow[];
  readonly options: readonly CameraOption[];
  readonly gate: SelectorGateState;
  /** "Checking your permissions…" while the role is unknown, else null (the card words the others). */
  readonly checkingHint: string | null;
  /** The row whose command is out or whose change has not been republished yet, or null. */
  readonly pendingKey: string | null;
  /** A command is out: every edit control ignores presses. */
  readonly busy: boolean;
  readonly notice: SelectorNotice | null;
  readonly retry: SelectorRetry;
  /** Task 3 row 138 (flow 12; D131): whether the data is a Core server's — the one fact the badge needs beside `sourceClass`. */
  readonly badgeMode: { readonly live: boolean };
  /** Sends one command; resolves with its class (`ok` included). Never rejects. */
  send(command: SelectorCommand): Promise<AnswerClass>;
  dismissNotice(): void;
}

export function useCaptureSelector(): CaptureSelector {
  const status = useRuntimeStatus();
  const sim = useSimInstance();
  const live = useMobileLive();
  const config = useSim((s) => s.captureConfig);
  const registry = useSim((s) => s.captureDevices);
  const sessionOpen = useSim(hasActiveSession);
  const role = useRoleGate(Permission.CAPTURE_CONFIG);
  const link = useCoreLinkNotice();

  const port = useMemo<SelectorPort>(() => (live === null ? simSelectorPort(sim) : liveSelectorPort(live.client)), [live, sim]);

  const [outKey, setOutKey] = useState<string | null>(null);
  const [awaited, setAwaited] = useState<{ rowKey: string; updatedAt: number } | null>(null);
  const [notice, setNotice] = useState<SelectorNotice | null>(null);
  const [retries, setRetries] = useState(0);
  const [cooldownS, setCooldownS] = useState(0);
  const lastCommand = useRef<SelectorCommand | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The Retry cooldown of a 503: a UI rate limit; it reads no Core time (§2.7).
  useEffect(() => {
    if (cooldownS <= 0) return undefined;
    const timer = setInterval(() => setCooldownS((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownS]);

  const gate = selectorGate({
    roleKnown: role.known,
    permitted: role.allowed,
    linkDown: link.offline,
    locked: config.locked || sessionOpen,
  });

  const send = useCallback(
    async (command: SelectorCommand): Promise<AnswerClass> => {
      if (inFlight.current) return 'failed';
      const rowKey = rowKeyOf(command);
      inFlight.current = true;
      lastCommand.current = command;
      setOutKey(rowKey);
      setNotice(null);
      const answer = await port.send(command);
      inFlight.current = false;
      if (answer.result !== 'ok') {
        reportRuntimeIssue(isExpectedRefusal(answer.result) ? 'warn' : 'error', 'devices.captureSelector', `selector command -> ${answer.result}`, {
          kind: command.kind,
          target: command.kind === 'camera' ? command.trackId : command.inputId,
          deviceId: command.kind === 'camera' ? command.deviceId : null,
          result: answer.result,
          status: answer.facts.status,
          code: answer.facts.code,
        });
      }
      if (!mounted.current) return answer.result;
      setOutKey(null);
      if (answer.result === 'ok') {
        setRetries(0);
        setCooldownS(0);
        setAwaited(answer.updatedAt === null ? null : { rowKey, updatedAt: answer.updatedAt });
      } else {
        setNotice({ result: answer.result, rowKey });
      }
      return answer.result;
    },
    [port],
  );

  const runRetry = useCallback(() => {
    const command = lastCommand.current;
    if (command === null || cooldownS > 0 || retries >= PANEL_MAX_RETRIES) return;
    const attempt = retries + 1;
    setRetries(attempt);
    setCooldownS(Math.ceil(panelRetryCooldownMs(attempt) / 1000));
    void send(command);
  }, [cooldownS, retries, send]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const cameras = useMemo(() => cameraRows(config, registry), [config, registry]);
  const mics = useMemo(() => micRows(config, registry), [config, registry]);
  const options = useMemo(() => cameraOptions(config, registry), [config, registry]);

  const awaiting = awaited !== null && isAwaitingRepublish(awaited.updatedAt, config.updatedAt);
  const pendingKey = outKey ?? (awaiting ? awaited.rowKey : null);
  const exhausted = retries >= PANEL_MAX_RETRIES;

  return {
    ready: status.ready,
    empty: isSelectorEmpty(config, registry),
    cameras,
    mics,
    options,
    gate,
    checkingHint: gate === 'checking' ? role.hint : null,
    pendingKey,
    busy: outKey !== null,
    notice,
    badgeMode: { live: live !== null },
    retry: { canRetry: cooldownS === 0 && !exhausted && outKey === null, cooldownS, exhausted, run: runRetry },
    send: useCallback(
      (command: SelectorCommand) => (isNoChange(command, config) ? Promise.resolve<AnswerClass>('ok') : send(command)),
      [config, send],
    ),
    dismissNotice,
  };
}
