/**
 * Transcripts module (blueprint row 78 / M6-W3 for the store; integration pass D4 for the routes).
 *
 *   store.ts          the sealed-transcript store: the database side of a sealed machine
 *                     transcript and of its signed revisions (dbc-3 §B.8, §B.9, §B.11). Its header
 *                     says who calls it and what one unit of work holds;
 *   statements.ts     the constant statements of that store;
 *   revision-body.ts  the canonical body of a revision: what is hashed and signed (pure);
 *   routes.ts         operations 84, 85, 86 of the shared registry.
 *
 * The files of a sealed package are another unit's (`src/transcript-package`): a module opens no
 * file itself (static rule G-R1).
 *
 * The store moved from this file to `store.ts` unchanged (pass D4) so that the routes can import
 * it without importing the index that exports them; every name it exported is exported here.
 */
import type { FastifyPluginAsync } from 'fastify';
import { registerRevisionHeadsBootStep } from './heads';
import { registerTranscriptRoutes } from './routes';

export * from './store';
export { TRANSCRIPT_HEADS_BOOT_STEP, TRANSCRIPT_HEADS_NOT_READ, TRANSCRIPT_HEAD_NOT_PUBLISHED, publishRevisionHeads } from './heads';
export {
  REVISION_REASON_MAX,
  REVISION_REASON_MIN,
  TRANSCRIPT_REVISION_BODY_SCHEMA_ID,
  changesOfStoredBody,
  revisionBodyOf,
  revisionDigestOf,
  revisionIdOf,
  storableReasonOf,
  type RevisionBody,
  type RevisionBodyInput,
  type RevisionChange,
} from './revision-body';
export {
  REVISION_UNIT_LABEL,
  TRANSCRIPTS_SOURCE,
  TRANSCRIPT_OPERATION_IDS,
  TranscriptReason,
  pageOfRevisions,
  provideRevisionSigner,
  reconciled,
  registerTranscriptRoutes,
  type RevisionSignerLoader,
  type TranscriptOperationId,
} from './routes';

/**
 * The plugin of the module: the three routes and ONE boot step (`heads.ts`, integration pass D11:
 * the stored revision heads go onto the replicated items after a start). It opens no database
 * connection, registers no hook and no seam, and reads no file until the boot or a request asks:
 * `buildApp()` works without PostgreSQL and without a media store.
 *
 * CONTRACT with the scaffold (`app.ts`): `transcriptsModule` keeps its name.
 */
export const transcriptsModule: FastifyPluginAsync = async (app) => {
  registerTranscriptRoutes(app);
  registerRevisionHeadsBootStep(app);
};
