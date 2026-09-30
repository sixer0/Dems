import { z } from 'zod';
import { CORE_HTTP_ORIGIN, HEALTH_PATH } from './constants';

/** `GET /api/v1/health` response body (masterplan/01_specs.md §2.5). */
export interface HealthResponse {
  status: 'ok';
  service: 'dems-mock-core';
  /** Equals apps/mock-core/package.json "version". */
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
}

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('dems-mock-core'),
  version: z.string().min(1),
  apiVersion: z.literal('v1'),
  serverTime: z.iso.datetime(),
  uptimeMs: z.int().nonnegative(),
  ws: z.object({
    path: z.literal('/ws'),
    heartbeatIntervalMs: z.literal(1000),
    clients: z.int().nonnegative(),
  }),
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
