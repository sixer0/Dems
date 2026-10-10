/**
 * The target of a connection test: WHERE the ONVIF session of a candidate camera is dialled, and
 * the same thing as text for the operator's confirmation (fix F-M4, R69-12 / D178).
 *
 * Moved out of `onvif-session.ts` by tidy pass F-Y: that file is the ONE file that holds the ONVIF
 * client and exports only its facade (static rule "the client never leaves the file",
 * `src/capture/__tests__/static.test.ts`). What is here is a PURE function of a candidate: no
 * client, no credential, no I/O, no module state. The session imports `targetOf` from here and the
 * search imports `connectionTargetOf` (through the adapters barrel), so the confirmed text and the
 * contacted address still come from one function.
 */
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import type { CameraCandidate } from '../types';

const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const SERVICE_PATH = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:%/]{0,127}$/;

export interface ConnectionTarget {
  readonly secure: boolean;
  readonly host: string;
  readonly port: number;
  readonly path: string;
}

/** The service address of a candidate, held once more to the candidate's own address (DS-9; SEC35-32 (2)). */
export function targetOf(candidate: CameraCandidate): ConnectionTarget {
  const refuse = (): never => {
    throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID);
  };
  if (!candidate.testable || candidate.conflict || candidate.serviceAddress === null || !IPV4.test(candidate.host)) return refuse();
  let parsed: URL;
  try {
    parsed = new URL(candidate.serviceAddress);
  } catch {
    return refuse();
  }
  const secure = parsed.protocol === 'https:';
  if (!secure && parsed.protocol !== 'http:') return refuse();
  // A user part is refused on the raw text: no parser quirk decides it, and this file reads no member of that name.
  if (candidate.serviceAddress.includes('@') || parsed.hostname !== candidate.host || parsed.hash !== '' || parsed.search !== '') return refuse();
  if (!SERVICE_PATH.test(parsed.pathname)) return refuse();
  const port = parsed.port === '' ? (secure ? 443 : 80) : Number(parsed.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return refuse();
  return { secure, host: candidate.host, port, path: parsed.pathname };
}

/**
 * The target of a connection test as TEXT, for the operator's confirmation (fix F-M4; review row
 * 69, finding R69-12; decision D178): scheme, host, port and path exactly as `targetOf` hands them
 * to the client object - the port written out also when it is the scheme's default. Null for a
 * candidate the test refuses before a request: there is nothing to confirm. One function with the
 * test, so the confirmed text cannot name another target than the contacted one.
 */
export function connectionTargetOf(candidate: CameraCandidate): string | null {
  try {
    const target = targetOf(candidate);
    return `http${target.secure ? 's' : ''}://${target.host}:${target.port}${target.path}`;
  } catch (error) {
    if (error instanceof CaptureAdapterError) return null;
    throw error;
  }
}
