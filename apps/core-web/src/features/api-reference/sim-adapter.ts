/**
 * API Reference bridge to the simulator (step 53; simplified by step 54, which closed W53-1..4 in
 * `packages/shared/src/sim`, D101). `simAwareFetch` (sim-fetch.ts) calls `answerSimulated`, never
 * `sim.request` directly, so the one try/catch and the structured log live here.
 *
 * The simulator now answers every case Try-it can produce:
 * - W53-1: malformed percent-encoding → 400 `INVALID_PATH` (`sim.request` never throws, review 40 m6);
 * - W53-2: any method → 405 with `allow` on a known path, 404 elsewhere (`SimApiRequest.method`
 *   admits every method);
 * - W53-3: `POST /api/v1/session` validates with `sessionCreateSchema` → 422 `INVALID_INPUT` (D62);
 * - W53-4: start and stop need SESSION_START → 401 `NOT_SIGNED_IN` / 403 `NOT_PERMITTED`, now
 *   documented on both operations in the OpenAPI document.
 */
import { SIMULATED_HEADER_NAME, SIMULATED_HEADER_VALUE } from '@dems/shared/api'
import { SIM_API_HEADERS, type Sim, type SimApiResponse } from '@dems/shared/sim'
import { logApiReference } from './log'

/** What the adapter needs from the simulator. */
export type SimTarget = Pick<Sim, 'request' | 'store'>

export interface SimulatedRequest {
  method: string
  /** Path under the Core origin, without query or fragment. */
  path: string
  /** Raw body text (the simulator parses JSON itself); undefined when there is none. */
  body?: string
}

function errorResponse(status: number, code: string, message: string): SimApiResponse {
  return {
    status,
    headers: { ...SIM_API_HEADERS, [SIMULATED_HEADER_NAME]: SIMULATED_HEADER_VALUE },
    body: { error: { code, message } },
  }
}

/**
 * Answers one simulated request through `sim.request`. Never throws: should the simulator fail
 * unexpectedly, the answer is a 500 `SIMULATOR_ERROR` (logged).
 */
export function answerSimulated(sim: SimTarget, request: SimulatedRequest): SimApiResponse {
  const method = request.method.toUpperCase()
  try {
    return sim.request({ method, path: request.path, ...(request.body !== undefined ? { body: request.body } : {}) })
  } catch (error) {
    logApiReference('error', 'answerSimulated', error, 'The simulator could not answer a Try-it request.', { method, path: request.path })
    return errorResponse(500, 'SIMULATOR_ERROR', 'The simulator could not answer this request.')
  }
}
