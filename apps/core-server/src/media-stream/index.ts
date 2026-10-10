/**
 * Media streaming (blueprint row 90, M8-W1; register NM-11; C3 §2.2 operation 88, §2.4, §5.1, §5.2,
 * §7; capture spec §D.4; UX flow 5; SEC35-12, SEC35-13, SEC35-16; closes NM-11 and the server side
 * of WB-04, MB-07 and E-31).
 *
 *   token.ts        the signed media session: form, binding, expiry. Pure
 *   ranges.ts       the `Range` header. Pure
 *   store-door.ts   the ONE file that reaches the Core credential store: the media-session signing
 *                   key (HMAC inside the store) and row 84's range plan
 *   items.ts        the six columns of an evidence item the unit reads
 *   source.ts       a camera file of a sealed v2 package as plaintext ranges: the package reader of
 *                   `src/evidence-verify`, the fragment opener of the Core, row 84's plan
 *   service.ts      the handlers of operation 88 and of `GET /media/:token`
 *   index.ts        this file: what the handlers are handed (`mediaStream(app)`)
 *
 * A UNIT AND A MODULE. Routes are registered by modules only (static rule of the permission
 * guard), and a module sets no header of an answer (static rule of `test/static/api-headers.test.ts`)
 * - while the Range route must set `content-range`, `accept-ranges`, `content-length` and
 * `content-type`. So `src/modules/media-stream` REGISTERS the two routes, and this unit, beside
 * `src/evidence-verify`, holds everything they do. It registers no route and no plugin, is closed
 * (imported through this index only) and has its own static rule (`__tests__/static.test.ts`).
 *
 * NO SECOND DECRYPTION PATH. A sealed fragment is opened by `coreFragmentOpener(app)` and by
 * nothing else; this unit names no cipher and reads no key.
 *
 * Building the service opens no database connection, no file and no key.
 */
import { randomBytes } from 'node:crypto';
import { sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { coreFragmentOpener } from '../evidence-verify';
import { readMediaItem, readSessionOpen } from './items';
import type { MediaStreamParts } from './service';
import { packageFolderOf } from './source';
import { mediaSessionMacOf } from './store-door';
import { MEDIA_TOKEN_NONCE_BYTES } from './token';

export { READ_MEDIA_ITEM, READ_SESSION_OPEN, readMediaItem, readSessionOpen, type MediaItem, type MediaItemReader } from './items';
export { contentRangeOf, decideRange, unsatisfiedRangeOf, type RangeDecision } from './ranges';
export {
  EVIDENCE_CASE_SCOPE_REASON,
  MEDIA_DENIED_UNIT,
  MEDIA_PLAN_CACHE_ENTRIES,
  MEDIA_ROUTE_PREFIX,
  MEDIA_ROUTE_URL,
  MEDIA_SERVED_UNIT,
  MEDIA_SESSION_CHECK_EVERY_PIECES,
  MEDIA_SESSION_ENDED_REASON,
  MEDIA_SESSION_ISSUED_UNIT,
  MEDIA_STREAM_OPERATIONS,
  MediaSessionRequestSchema,
  NOT_A_SEALED_PACKAGE_REASON,
  RANGE_NOT_SATISFIABLE_REASON,
  createMediaStreamService,
  holdsCase,
  type MediaStreamOperation,
  type MediaStreamParts,
  type MediaStreamService,
} from './service';
export { CLEAR_CHUNK_BYTES, MediaSourceError, MediaSourceFailure, packageFolderOf, planMediaFile, readPlain, type MediaFilePlan, type MediaSourcePorts } from './source';
export { MEDIA_SESSION_KEY_BYTES, MEDIA_SESSION_KEY_SECRET_NAME, mediaSessionMacOf } from './store-door';
export {
  MEDIA_TOKEN_MAC_BYTES,
  MEDIA_TOKEN_MAX_CHARS,
  MEDIA_TOKEN_NONCE_BYTES,
  MEDIA_TOKEN_PATTERN,
  MEDIA_TOKEN_VERSION,
  MediaTokenRefusal,
  issueMediaToken,
  readMediaToken,
  type MediaSessionMac,
  type MediaTokenClaims,
  type MediaTokenHolder,
  type MediaTokenReading,
} from './token';

/** What the unit offers beside its routes. */
export interface MediaStreamControl {
  /** What the routes work with now. */
  parts(): MediaStreamParts;
  /**
   * A TEST puts its own parts in the place of the app's (a package folder of its own, a fixed
   * nonce, an item that is a value). No production file calls it: the unit's static test holds that.
   */
  replaceForTest(parts: Partial<MediaStreamParts>): void;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `evidenceVerification(app)` idiom).
const controls = new WeakMap<object, MediaStreamControl>();

/** The control of an app. It exists from the first call. */
export function mediaStream(app: FastifyInstance): MediaStreamControl {
  const known = controls.get(app.stages);
  if (known !== undefined) return known;
  const own: MediaStreamParts = {
    // `<media root>/SESSION-<sessionId>` (decision D133 (2); evidence package spec §A.2).
    packageDirOf(sessionId) {
      const folder = packageFolderOf(sessionId);
      return folder === null ? null : `${app.config.mediaStoreDir}${sep}${folder}`;
    },
    opener: coreFragmentOpener(app),
    // Asked per call: the store of the app decides once whether it is there, and says so every time.
    mac: () => mediaSessionMacOf(app),
    readItem: (request, evidenceId) => app.db.read('mediaStream.readItem', (pool) => readMediaItem({ query: (text, values) => pool.query(text, [...values]) }, evidenceId), request),
    nonce: () => randomBytes(MEDIA_TOKEN_NONCE_BYTES),
    sessionOpen: (request, sessionId) => app.db.read('mediaStream.sessionOpen', (pool) => readSessionOpen({ query: (text, values) => pool.query(text, [...values]) }, sessionId), request),
  };
  let replaced: Partial<MediaStreamParts> = {};
  const control: MediaStreamControl = {
    parts: () => ({ ...own, ...replaced }),
    replaceForTest(parts) {
      replaced = { ...replaced, ...parts };
    },
  };
  controls.set(app.stages, control);
  return control;
}
