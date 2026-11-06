/**
 * A tiny signal for "the Core link came back" (04_mobile_specs §5.5: the heartbeat client's
 * `onResync` → `SessionRouteSync.resync()`). `AppProviders` owns one bus, emits it from the
 * `HeartbeatProvider` `onResync`, and passes it to `SimRuntimeProvider`; the route sync and the
 * connection banner subscribe. Listener errors are contained and logged.
 */
import { reportRuntimeIssue } from './log';

export interface ResyncBus {
  emit(): void;
  /** Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export function createResyncBus(): ResyncBus {
  const listeners = new Set<() => void>();
  return {
    emit() {
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          reportRuntimeIssue('error', 'runtime.resyncBus.listener', error);
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
