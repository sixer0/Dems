import { z } from 'zod';
import { CORE_HTTP_ORIGIN, CORE_SERVER_SERVICE_NAME, HEALTH_PATH, SERVICE_NAME } from './constants';

/**
 * `GET /api/v1/health` response body (masterplan/01_specs.md §2.5).
 *
 * Widened additively by the backend task (2026-10-04 01_specs §7.4): `service` names the
 * answering service, and the Core server adds `ready`. mock-core's and the packaged launcher's
 * answers are unchanged and stay valid.
 */
export interface HealthResponse {
  status: 'ok';
  /** `dems-mock-core` (mock-core, the packaged launcher) or `dems-core-server` (the Core server). */
  service: 'dems-mock-core' | 'dems-core-server';
  /** Equals the "version" of the answering service's package.json. */
  version: string;
  apiVersion: 'v1';
  /** ISO-8601 UTC, e.g. "2026-09-30T16:41:00.000Z". */
  serverTime: string;
  /** Integer, >= 0. */
  uptimeMs: number;
  ws: {
    path: '/ws';
    heartbeatIntervalMs: 1000;
    /** Currently connected WS clients, integer >= 0. */
    clients: number;
  };
  /**
   * Core server only. The status is 200 while the process answers; a stopped database shows as
   * `database: false`, an engine that is not rehydrated yet as `engine: false`.
   */
  ready?: { database: boolean; engine: boolean };
}

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.enum([SERVICE_NAME, CORE_SERVER_SERVICE_NAME]),
  version: z.string().min(1),
  apiVersion: z.literal('v1'),
  serverTime: z.iso.datetime(),
  uptimeMs: z.int().nonnegative(),
  ws: z.object({
    path: z.literal('/ws'),
    heartbeatIntervalMs: z.literal(1000),
    clients: z.int().nonnegative(),
  }),
  ready: z.object({ database: z.boolean(), engine: z.boolean() }).optional(),
});

// Compile-time proof that the schema and the interface describe the same shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const healthSchemaMatches: Exact<z.infer<typeof HealthResponseSchema>, HealthResponse> = true;
void healthSchemaMatches;

/** TanStack Query key for the health snapshot (both apps; the heartbeat resync invalidates it). */
export const HEALTH_QUERY_KEY = ['health'] as const;

/** `GET http://127.0.0.1:4400/api/v1/health`, validated with `HealthResponseSchema`. */
export async function fetchHealth(fetchImpl: typeof fetch = fetch): Promise<HealthResponse> {
  const response = await fetchImpl(`${CORE_HTTP_ORIGIN}${HEALTH_PATH}`);
  if (!response.ok) throw new Error(`GET ${HEALTH_PATH} -> HTTP ${response.status}`);
  return HealthResponseSchema.parse(await response.json());
}
