/**
 * The live camera preview and the idle microphone meters at the API (decisions D51, D53).
 *
 *   service.ts   the handlers of operations 112 and 113 and of `GET /preview/:token`
 *   index.ts     this file: what the handlers are handed (`cameraPreview(app)`)
 *
 * A UNIT AND A MODULE, as the media route: `src/modules/camera-preview` REGISTERS the three routes
 * (routes are registered by modules only), and this unit holds what they do, the headers of the
 * stream included (a module sets no header of an answer). It registers no route and no plugin.
 *
 * WHAT IT IS HANDED. The preview manager and the idle meters are built by the composition of
 * production capture (`src/capture-composition.ts`), which hands them in once through
 * `cameraPreview(app).provide(...)`. Until then - and for good on a Core that is not in production
 * capture - operation 112 answers `PREVIEW_NOT_AVAILABLE` and operation 113
 * `IDLE_METERS_NOT_AVAILABLE`. This unit imports nothing of the capture unit: it knows the two by
 * shape.
 *
 * Building the control opens no database connection, no file and no socket.
 */
import type { FastifyInstance } from 'fastify';
import { describeError } from '../plugins/logger';
import type { CameraPreviewManagerShape, CameraPreviewParts, IdleMetersShape, PreviewDevice } from './service';
import { previewTokenBytes } from './service';

export {
  CAMERA_PREVIEW_OPERATIONS,
  PREVIEW_ADAPTER_KIND,
  PREVIEW_BOUNDARY,
  PREVIEW_DENIED_UNIT,
  PREVIEW_ROUTE_PREFIX,
  PREVIEW_ROUTE_URL,
  PREVIEW_SESSION_CHECK_MS,
  PREVIEW_SESSION_ENDED_REASON,
  PREVIEW_SESSION_ISSUED_UNIT,
  PREVIEW_TOKENS_KEPT,
  PREVIEW_TOKEN_PATTERN,
  PREVIEW_VIEWER_BUFFER_BYTES,
  PreviewTokenRefusal,
  createCameraPreviewService,
  previewPartOf,
  type CameraPreviewManagerShape,
  type CameraPreviewOperation,
  type CameraPreviewParts,
  type CameraPreviewService,
  type IdleMetersShape,
  type PreviewDevice,
  type PreviewSinkShape,
  type PreviewViewerPlace,
} from './service';

/** The registered device as operation 112 reads it. One row or none: `id` is the primary key. */
export const READ_PREVIEW_DEVICE = 'SELECT kind, adapter_kind AS "adapterKind", retired_at AS "retiredAt" FROM public.capture_devices WHERE id = $1';
/** True while the sign-in session of that ID is open (the statement of the media route). */
export const READ_PREVIEW_SESSION_OPEN = 'SELECT 1 AS open FROM public.auth_sessions WHERE id::text = $1 AND ended_at IS NULL';

/** What the composition of production capture hands in. */
export interface CameraPreviewProvision {
  readonly manager: CameraPreviewManagerShape | null;
  readonly idleMeters: IdleMetersShape | null;
  /** Ends both for good (the app closes). Never rejects. */
  readonly close?: () => Promise<void>;
}

export interface CameraPreviewControl {
  /** What the routes work with now. */
  parts(): CameraPreviewParts;
  /** Called once by the composition of production capture. A second call throws. */
  provide(provision: CameraPreviewProvision): void;
  /** Ends what was provided (the module's close hook). Never rejects. */
  close(): Promise<void>;
  /** A TEST puts its own parts in the place of the app's. No production file calls it. */
  replaceForTest(parts: Partial<CameraPreviewParts>): void;
}

const deviceOf = (rows: readonly unknown[]): PreviewDevice | null => {
  const row = rows[0];
  if (rows.length !== 1 || typeof row !== 'object' || row === null) return null;
  const { kind, adapterKind, retiredAt } = row as { kind?: unknown; adapterKind?: unknown; retiredAt?: unknown };
  if (typeof kind !== 'string' || typeof adapterKind !== 'string') return null;
  return { kind, adapterKind, retired: retiredAt !== null && retiredAt !== undefined };
};

// Keyed by the app's stage registry: one object per app, the same from every scope of it.
const controls = new WeakMap<object, CameraPreviewControl>();

/** The control of an app. It exists from the first call. */
export function cameraPreview(app: FastifyInstance): CameraPreviewControl {
  const known = controls.get(app.stages);
  if (known !== undefined) return known;
  let provided: CameraPreviewProvision | null = null;
  const own: CameraPreviewParts = {
    device: (request, deviceId) => app.db.read('cameraPreview.device', async (pool) => deviceOf((await pool.query(READ_PREVIEW_DEVICE, [deviceId])).rows), request),
    sessionOpen: (request, sessionId) => app.db.read('cameraPreview.sessionOpen', async (pool) => (await pool.query(READ_PREVIEW_SESSION_OPEN, [sessionId])).rows.length > 0, request),
    manager: () => provided?.manager ?? null,
    idleMeters: () => provided?.idleMeters ?? null,
    tokenBytes: previewTokenBytes,
  };
  let replaced: Partial<CameraPreviewParts> = {};
  const control: CameraPreviewControl = {
    parts: () => ({ ...own, ...replaced }),
    provide(provision) {
      if (provided !== null) throw new Error('the live camera preview was provided twice');
      provided = Object.freeze({ manager: provision.manager, idleMeters: provision.idleMeters, ...(provision.close === undefined ? {} : { close: provision.close }) });
    },
    async close() {
      const close = provided?.close;
      if (close === undefined) return;
      try {
        await close();
      } catch (error) {
        app.log.error({ err: error, source: 'cameraPreview.close' }, 'the live camera preview could not be closed');
        app.errorLog.append({ level: 'error', source: 'cameraPreview.close', message: 'the live camera preview could not be closed', ...describeError(error), context: {} });
      }
    },
    replaceForTest(parts) {
      replaced = { ...replaced, ...parts };
    },
  };
  controls.set(app.stages, control);
  return control;
}
