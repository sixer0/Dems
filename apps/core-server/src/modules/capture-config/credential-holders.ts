/**
 * THE HOLDERS OF THE CREDENTIAL READER: the ONE file that builds the handout and takes the two
 * readers (task 4 blueprint row 144; security check 04 item 2, requirement AD-03 points 1 and 4,
 * weakness W-1; design addendum 04 section 2.3; `implementation/045_credential_reader.md`).
 *
 * WHY A FILE OF ITS OWN. The reader is the one object that returns a live camera credential. Its
 * importers are a closed list held by a static rule (`__tests__/static.test.ts`, rule R-3), and
 * this file is that list: nothing else of the server imports the reader. A holder does not import
 * it either - it RECEIVES its reader as a parameter, from the pair this file returns:
 *
 *   | Member          | Holder                                         | Can say                         |
 *   |-----------------|------------------------------------------------|---------------------------------|
 *   | `cameraAdapter` | the production camera adapter (`openSource`)   | `SESSION_OPEN`, `RELAY_RESTART` |
 *   | `connectionTest`| the connection test of an ADOPTED camera       | `CONNECTION_TEST`               |
 *
 * No member takes a reason; each reader was taken ONCE from the handout, which is then dropped, so
 * nothing can obtain a third reader of this app (a second `take` is refused by the reader itself).
 *
 * NOT CALLED BY ANY BOOT PATH TODAY. The production camera adapter is still a class-C stub (the
 * lift is WP-13); it has no opener and gets none here. This file is imported by no production
 * source (rule R-6 holds that list empty): the production composition (the registry builder, row
 * 85) and the stored-credential connection test (row 50) take the pair later, each by a decision
 * that adds its file to that list. The module index does not export this file.
 *
 * WHAT THE COMPOSITION MUST PASS, AND ONE RULE IT MUST KEEP:
 *
 *   - `unit`: `app.pipeline.run`. A READ NEVER RUNS INSIDE A UNIT OF WORK. The reader opens its own
 *     unit (reveal and audit entry) and the pipeline refuses a nested one (`PIPELINE_REENTRANT`),
 *     which the reader answers as `CAPTURE_CREDENTIAL_REVEAL_FAILED` with no credential and no
 *     entry. So a holder calls its reader outside the session-start unit, and outside the adoption
 *     unit;
 *   - `open`: `store.capture.open` of the READY Core credential store;
 *   - `errorLog`: `app.errorLog`;
 *   - `query`: one read on the pool as the runtime role, outside any unit (`app.db.read`);
 *   - `storedAddress`: the destination rule on a stored camera address - `decideDestination` with
 *     the purpose `STORED_CAMERA`, bound to the host's facts. It is a parameter because the rule's
 *     file lies inside the closed capture unit; the composition that passes it lies there too.
 *
 * The device facts are read HERE, by one constant statement with one bind parameter: three columns
 * of the registry row, never a credential column (the runtime role cannot read that table).
 */
import {
  CaptureCredentialHolder,
  createCaptureCredentialReaders,
  type CameraAdapterCredentialReader,
  type CaptureCredentialDevice,
  type CaptureCredentialReaderDependencies,
  type ConnectionTestCredentialReader,
} from './credential-reader';

/** What the gate reads of a registered device. One row or none: `id` is the primary key. */
export const READ_CAPTURE_CREDENTIAL_DEVICE = 'SELECT kind, adapter_kind, address FROM public.capture_devices WHERE id = $1';

export interface CaptureCredentialHoldersDependencies extends Pick<CaptureCredentialReaderDependencies, 'unit' | 'open' | 'errorLog' | 'storedAddress'> {
  /** One read on the pool as the runtime role, OUTSIDE any unit of work. */
  query(text: string, values: unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
}

/** The two readers of one app, each for the holder its name says. Frozen. */
export interface CaptureCredentialHolders {
  readonly cameraAdapter: CameraAdapterCredentialReader;
  readonly connectionTest: ConnectionTestCredentialReader;
}

const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** The stored facts of one row; null for no row and for a row whose two closed-set columns are not texts. */
function deviceOf(rows: readonly unknown[]): CaptureCredentialDevice | null {
  const row = rows[0];
  if (rows.length !== 1 || typeof row !== 'object' || row === null) return null;
  const { kind, adapter_kind: adapterKind, address } = row as { kind?: unknown; adapter_kind?: unknown; address?: unknown };
  if (typeof kind !== 'string' || typeof adapterKind !== 'string') return null;
  return { kind, adapterKind, address: textOrNull(address) };
}

/**
 * Builds the readers of one app and returns the pair the two holders are handed. Called once per
 * app, by the production composition; a second call builds a second, independent pair, which is
 * why the callers of this function are a pinned list too.
 */
export function wireCaptureCredentialHolders(dependencies: CaptureCredentialHoldersDependencies): CaptureCredentialHolders {
  const { unit, open, errorLog, storedAddress, query } = dependencies;
  const handout = createCaptureCredentialReaders({
    unit,
    open,
    errorLog,
    storedAddress,
    device: async (deviceId) => deviceOf((await query(READ_CAPTURE_CREDENTIAL_DEVICE, [deviceId])).rows),
  });
  return Object.freeze({
    cameraAdapter: handout.take(CaptureCredentialHolder.CAMERA_ADAPTER),
    connectionTest: handout.take(CaptureCredentialHolder.CONNECTION_TEST),
  });
}
