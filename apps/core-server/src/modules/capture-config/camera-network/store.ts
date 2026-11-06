/**
 * The one read of the set-IP job (task 4 blueprint row 111): the stored addresses of the registered
 * production cameras, for the rule of the address a camera is given ("not a registered camera's",
 * S13-11). A constant text without a parameter; it runs as the runtime role on the pool. The job
 * WRITES no row of any table but its audit entries: a registered camera's stored address is
 * changed by operation 100, on the operator's confirmation, never here.
 */
import type { QueryResultRow } from 'pg';

/** A connection that runs one statement: the pool of a read. */
export interface Queryable {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<{ readonly rows: Row[] }>;
}

/** Every registered ONVIF camera that has an address, as stored (`host` or `host:port`). */
export const READ_REGISTERED_CAMERA_ADDRESSES = `SELECT address FROM public.capture_devices WHERE kind = 'CAMERA' AND adapter_kind = 'ONVIF_RTSP' AND address IS NOT NULL ORDER BY id`;

/** The stored addresses, each as it stands. A value that is no text is handed on as an empty text: the rule then refuses the job until the registry is clean. */
export async function readRegisteredCameraAddresses(db: Queryable): Promise<readonly string[]> {
  const { rows } = await db.query(READ_REGISTERED_CAMERA_ADDRESSES);
  return rows.map((row) => (typeof row['address'] === 'string' ? row['address'] : ''));
}
