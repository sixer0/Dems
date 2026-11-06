/**
 * What a search knows of the REGISTERED cameras (blueprint row 132; C3 §2.6 `CaptureCandidate.status`,
 * erratum PE-128-23; database contract `dbc-4` §N.5; decision D83 D-DB-15).
 *
 * "ALREADY REGISTERED" is decided by identity, in this order:
 *   1. the announced endpoint reference equals a stored `onvif_uuid`;
 *   2. else the address adoption would store for the candidate - its host, or its host and port
 *      when its service address names a port - equals the WHOLE stored `address`.
 * Never by a part of an address, a name or a model: those are what a device announces about itself.
 *
 * One READ per search, before the probe is sent: `id`, `address` and `onvif_uuid` of the camera
 * rows. A search writes nothing to `capture_devices` (R-9 AC-3). The rows stay inside this file's
 * matcher: no log line, no audit row and no answer carries an `onvif_uuid` or a stored address.
 */
import type { RegisteredLookup, RegisteredMatch } from '../../capture/adapters';

/** The camera rows of the registry, by the two identities a candidate can match. No other column is read. */
export const READ_REGISTERED_CAMERAS = "SELECT id, address, onvif_uuid FROM public.capture_devices WHERE kind = 'CAMERA' ORDER BY id";

export interface RegisteredCamera {
  readonly id: string;
  readonly address: string | null;
  readonly onvifUuid: string | null;
}

export interface RegisteredReader {
  query(text: string): Promise<{ rows: Array<{ id: unknown; address: unknown; onvif_uuid: unknown }> }>;
}

const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export async function readRegisteredCameras(reader: RegisteredReader): Promise<RegisteredCamera[]> {
  const { rows } = await reader.query(READ_REGISTERED_CAMERAS);
  return rows.flatMap((row) => (typeof row.id === 'string' ? [{ id: row.id, address: textOrNull(row.address), onvifUuid: textOrNull(row.onvif_uuid) }] : []));
}

/** `host`, or `host:port` when the service address names a port: the address adoption would store. Null for an address that is no URL. */
export function adoptionAddressOf(host: string, serviceAddress: string | null): string {
  if (serviceAddress === null) return host;
  try {
    const { port } = new URL(serviceAddress);
    return port === '' ? host : `${host}:${port}`;
  } catch {
    return host;
  }
}

export interface RegisteredIndex {
  /** The registered device a candidate is, or null. */
  deviceOf(candidate: { readonly endpointRef: string | null; readonly host: string; readonly serviceAddress: string | null }): { readonly deviceId: string; readonly byEndpointRef: boolean } | null;
  /** The adapter's lookup (the registered-first cap and `addressChanged`): it is given the endpoint reference and the host only. */
  readonly lookup: RegisteredLookup;
  readonly count: number;
}

export function registeredIndexOf(cameras: readonly RegisteredCamera[]): RegisteredIndex {
  const byUuid = new Map<string, RegisteredCamera>();
  const byAddress = new Map<string, RegisteredCamera>();
  for (const camera of cameras) {
    if (camera.onvifUuid !== null && !byUuid.has(camera.onvifUuid)) byUuid.set(camera.onvifUuid, camera);
    if (camera.address !== null && !byAddress.has(camera.address)) byAddress.set(camera.address, camera);
  }
  return {
    count: cameras.length,
    deviceOf(candidate) {
      const byReference = candidate.endpointRef === null ? undefined : byUuid.get(candidate.endpointRef);
      if (byReference !== undefined) return { deviceId: byReference.id, byEndpointRef: true };
      const whole = byAddress.get(adoptionAddressOf(candidate.host, candidate.serviceAddress));
      return whole === undefined ? null : { deviceId: whole.id, byEndpointRef: false };
    },
    lookup({ endpointRef, host }): RegisteredMatch | null {
      const byReference = byUuid.get(endpointRef);
      if (byReference !== undefined) {
        // The stored address may carry a port: only its host part can be compared with the answering address.
        const stored = byReference.address;
        const storedHost = stored === null ? null : stored.includes(':') && !stored.includes('::') ? stored.slice(0, stored.lastIndexOf(':')) : stored;
        return { storedHost, byEndpointRef: true };
      }
      const whole = byAddress.get(host);
      return whole === undefined ? null : { storedHost: whole.address, byEndpointRef: false };
    },
  };
}
