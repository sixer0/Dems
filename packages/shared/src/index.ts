/**
 * @dems/shared root entry: framework-free exports only (domain, API contract, tokens and the
 * heartbeat client). The React provider and hook live under `@dems/shared/realtime`, so
 * Node consumers such as mock-core never load React.
 */
export * from './domain';
export * from './api';
export * from './tokens';
export {
  createHeartbeatClient,
  reconnectDelayMs,
  type HeartbeatClient,
  type HeartbeatClientOptions,
  type HeartbeatSnapshot,
  type SocketFactory,
  type SocketLike,
} from './realtime/heartbeat-client';
export { DISPLAY_UTC_OFFSET_MINUTES, formatClock } from './realtime/format';
