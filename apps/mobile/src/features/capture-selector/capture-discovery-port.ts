/**
 * The one way the tablet and the phone send the three operations of flows 9 and 13 a device session
 * may call (task 3, blueprint row 138; `masterplan/03_api_contract.md` §2.6):
 *
 * | Operation | Call |
 * |---|---|
 * | 93 `startCaptureDiscovery` | `start()` — sent with no body: no address, subnet, port or filter. The contract's one optional member, `address` (task 4 row 94), is for the web console only and this port never sends it |
 * | 94 `getCaptureDiscovery` | `read()` — the caller's own search and list; it never probes |
 * | 97 `rescanCaptureInputs` | `rescan()` — one request, one answer; nothing on the network |
 *
 * The other three operations of that section — the connection test, the adoption and the camera
 * password write — carry a camera password and are web-console-only (D80(3)): this port has NO
 * member for them, the app names none of their operation ids, and the Core (and the in-app
 * simulator, `deviceConsole: true`) refuses a device session that forces one.
 *
 * Two ways in, as `capture-selector-port.ts`: `sim.request` for SIMULATED and HEARTBEAT (the
 * simulator is the Core), `client.call` for LIVE (rule 1 of the mobile page rows: no typed client of
 * the page's own, no raw fetch). Never throws: a transport that throws is "no answer". Pure of React.
 * Nothing of an answer is kept here; the caller holds the result in component state only (§8c.4:
 * not persisted, not part of any slice).
 */
import type { Sim } from '@dems/shared/sim';
import type { MobileCoreClient } from '@/runtime';
import { searchFactsOf, type SearchAnswerFacts } from './camera-search-model';

export interface DiscoveryAnswer {
  readonly facts: SearchAnswerFacts;
  /** The body of a 2xx answer; null otherwise. */
  readonly body: unknown;
}

export interface DiscoveryPort {
  /** Operation 93. */
  start(): Promise<DiscoveryAnswer>;
  /** Operation 94. */
  read(): Promise<DiscoveryAnswer>;
  /** Operation 97. */
  rescan(): Promise<DiscoveryAnswer>;
}

export const CAPTURE_DISCOVERY_PATH = '/api/v1/capture/discovery';
export const CAPTURE_INPUT_RESCAN_PATH = '/api/v1/capture/inputs/rescan';

const NO_ANSWER: DiscoveryAnswer = { facts: { status: null, code: null, reason: null, retryAfterS: null }, body: null };

const isSuccess = (status: number): boolean => status >= 200 && status < 300;

function headerSeconds(headers: Readonly<Record<string, string>> | undefined): number | null {
  const raw = headers?.['retry-after'];
  const seconds = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/** SIMULATED and HEARTBEAT: the in-app simulator answers the request synchronously. */
export function simDiscoveryPort(sim: Pick<Sim, 'request'>): DiscoveryPort {
  const send = (method: 'GET' | 'POST', path: string): Promise<DiscoveryAnswer> => {
    try {
      const response = sim.request({ method, path });
      const facts = searchFactsOf(response.status, response.body, headerSeconds(response.headers));
      return Promise.resolve({ facts, body: isSuccess(response.status) ? response.body : null });
    } catch {
      return Promise.resolve(NO_ANSWER);
    }
  };
  return {
    start: () => send('POST', CAPTURE_DISCOVERY_PATH),
    read: () => send('GET', CAPTURE_DISCOVERY_PATH),
    rescan: () => send('POST', CAPTURE_INPUT_RESCAN_PATH),
  };
}

type DeviceSessionOperation = 'startCaptureDiscovery' | 'getCaptureDiscovery' | 'rescanCaptureInputs';

/** LIVE: the Core server answers through the app's one typed client. */
export function liveDiscoveryPort(client: Pick<MobileCoreClient, 'call'>): DiscoveryPort {
  const send = async (operationId: DeviceSessionOperation): Promise<DiscoveryAnswer> => {
    try {
      const answer = await client.call(operationId);
      if (answer.ok) return { facts: { status: answer.status, code: null, reason: null, retryAfterS: null }, body: answer.data };
      return { facts: searchFactsOf(answer.status, { error: answer.error }, answer.retryAfterSeconds), body: null };
    } catch {
      return NO_ANSWER;
    }
  };
  return {
    start: () => send('startCaptureDiscovery'),
    read: () => send('getCaptureDiscovery'),
    rescan: () => send('rescanCaptureInputs'),
  };
}
