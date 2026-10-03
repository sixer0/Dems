/**
 * Keep-awake during a session (04_mobile_specs §6.6, S28; MA-19).
 *
 * The `dems-session` tag is held while the session is PRECHECK, ARMED, RECORDING, STOPPING or
 * FINALIZING, and released otherwise. Two holders use one manager:
 * - the runtime's own controller inside `SimRuntimeProvider`, always mounted, so the screen stays
 *   on while a session runs even when nobody is signed in ("released on sign-out only if no
 *   session is active", §6.6);
 * - the `KeepAwakeController` that `(app)/_layout.tsx` mounts (step 70).
 * The tag is held while any holder wants it. The stack-check screen keeps its own `useKeepAwake()`
 * (row 18), which uses a different tag.
 */
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useId } from 'react';
import type { SessionState } from '@dems/shared/domain';
import { useActiveSession } from './contract';
import { reportRuntimeIssue } from './log';

export const KEEP_AWAKE_TAG = 'dems-session';

export const KEEP_AWAKE_STATES: ReadonlySet<SessionState> = new Set<SessionState>([
  'PRECHECK',
  'ARMED',
  'RECORDING',
  'STOPPING',
  'FINALIZING',
]);

export function shouldKeepAwake(state: SessionState | null): boolean {
  return state !== null && KEEP_AWAKE_STATES.has(state);
}

export interface KeepAwakeApi {
  activate(tag: string): Promise<void>;
  deactivate(tag: string): Promise<void>;
}

const EXPO_KEEP_AWAKE: KeepAwakeApi = {
  activate: (tag) => activateKeepAwakeAsync(tag),
  deactivate: (tag) => deactivateKeepAwake(tag),
};

export interface KeepAwakeManager {
  /** Records whether `holder` wants the screen kept on; applies the union of all holders. */
  set(holder: string, wants: boolean): void;
  isHeld(): boolean;
}

export function createKeepAwakeManager(api: KeepAwakeApi = EXPO_KEEP_AWAKE, tag = KEEP_AWAKE_TAG): KeepAwakeManager {
  const holders = new Set<string>();
  let held = false;
  const apply = () => {
    const want = holders.size > 0;
    if (want === held) return;
    held = want;
    const call = want ? api.activate(tag) : api.deactivate(tag);
    Promise.resolve(call).catch((error: unknown) =>
      reportRuntimeIssue('warn', want ? 'runtime.keepAwake.activate' : 'runtime.keepAwake.deactivate', error, { tag }),
    );
    reportRuntimeIssue('info', 'runtime.keepAwake', want ? 'Screen kept on for the session' : 'Screen keep-on released', { tag });
  };
  return {
    set(holder, wants) {
      if (wants) holders.add(holder);
      else holders.delete(holder);
      try {
        apply();
      } catch (error) {
        reportRuntimeIssue('warn', 'runtime.keepAwake.apply', error, { tag });
      }
    },
    isHeld: () => held,
  };
}

/** The app's manager (one tag, one process). */
export const keepAwakeManager = createKeepAwakeManager();

export interface KeepAwakeControllerProps {
  /** Tests inject a manager with a fake keep-awake API. */
  manager?: KeepAwakeManager;
}

/** Holds `dems-session` while the contract's session is in a keep-awake state (§6.6). Renders nothing. */
export function KeepAwakeController({ manager = keepAwakeManager }: KeepAwakeControllerProps): null {
  const { state } = useActiveSession();
  const holder = useId();
  const wants = shouldKeepAwake(state);
  useEffect(() => {
    manager.set(holder, wants);
  }, [manager, holder, wants]);
  // Unmount (for example sign-out removes `(app)`): this holder lets go; the runtime's own holder
  // keeps the tag while a session is active.
  useEffect(() => () => manager.set(holder, false), [manager, holder]);
  return null;
}
