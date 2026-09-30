import { createContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CORE_WS_URL } from '../api/constants';
import { createHeartbeatClient, type HeartbeatClient, type SocketFactory } from './heartbeat-client';

export const HeartbeatContext = createContext<HeartbeatClient | null>(null);

export interface HeartbeatProviderProps {
  /** Defaults to `CORE_WS_URL` (`ws://127.0.0.1:4400/ws`). */
  url?: string;
  /** Defaults to the global `WebSocket`; tests pass a fake. */
  socketFactory?: SocketFactory;
  /** Called after a reconnect delivers its first heartbeat (apps invalidate the `['health']` query). */
  onResync?: () => void;
  children: ReactNode;
}

/**
 * Owns one heartbeat client (one socket) per app and starts it on mount.
 * Every `useHeartbeat()` below it reads the same snapshot.
 */
export function HeartbeatProvider({
  url = CORE_WS_URL,
  socketFactory,
  onResync,
  children,
}: HeartbeatProviderProps) {
  // Keep the latest callback without recreating the client.
  const onResyncRef = useRef(onResync);
  useEffect(() => {
    onResyncRef.current = onResync;
  }, [onResync]);

  const [client] = useState(() =>
    createHeartbeatClient({
      url,
      ...(socketFactory ? { socketFactory } : {}),
      onResync: () => onResyncRef.current?.(),
    }),
  );

  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);

  return <HeartbeatContext.Provider value={client}>{children}</HeartbeatContext.Provider>;
}
