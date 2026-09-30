import { useContext, useSyncExternalStore } from 'react';
import type { HeartbeatSnapshot } from './heartbeat-client';
import { HeartbeatContext } from './heartbeat-context';

/** The current heartbeat snapshot from the nearest `HeartbeatProvider`. */
export function useHeartbeat(): HeartbeatSnapshot {
  const client = useContext(HeartbeatContext);
  if (!client) {
    throw new Error('useHeartbeat() must be used inside <HeartbeatProvider>.');
  }
  return useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
}
