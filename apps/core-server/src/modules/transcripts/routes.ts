/**
 * The routes of the transcript operations (task 3 integration pass D4; contract C3 §2.2, §2.3,
 * §2.4 "Transcript (84-86)"; transcript spec §A.6; evidence package spec §B.7, §C.1, §D V-11;
 * OD-15; SEC35-20, SEC35-21):
 *
 *   84  getTranscript             GET  /api/v1/evidence/{id}/transcript             EVIDENCE_VIEW
 *   85  createTranscriptRevision  POST /api/v1/evidence/{id}/transcript/revisions   TRANSCRIPT_REVISE
 *   86  listTranscriptRevisions   GET  /api/v1/evidence/{id}/transcript/revisions   EVIDENCE_VIEW
 *
 * WHO MAY CALL is stage 6 (`plugins/permission-guard`), by the access rule of the registry; no
 * route here has a check or a hook of its own. Operation 85 reads ONE member of the caller: the
 * operator ID, which is recorded as the author of the revision (OD-15: "author recorded").
 *
 * WHICH ITEMS HAVE A TRANSCRIPT. An item whose seal committed a `transcripts` row: a REAL v2
 * package sealed with a machine transcript (`FINALIZE_TRANSCRIPT`, rows 79 / 82). Every other item
 * - a v1 item, a simulated or demo item, a v2 item sealed with STT disabled or without a document
 * - answers `409 TRANSCRIPT_NOT_READY` on all three operations: there is no document, and none is
 * made up (D-EV-1). The simulator's in-memory revisions of a simulated item have no stored form
 * (no table holds their text), so the Core does not offer them; see the note of this pass.
 *
 * A REVISION NEVER OVERWRITES THE SEALED TRANSCRIPT (OD-15).
 *   - `transcripts` and `evidence_items.transcript_sha256` are never written here: the runtime
 *     role holds no UPDATE on either (migration 0005), and this module holds no such statement;
 *   - the package's `transcript.json`, `session-manifest.json` and `signature.sig` are only read;
 *   - a revision is a DERIVED record: one INSERT into `transcript_revisions` (author, reason,
 *     time, the hash of its canonical body, the Core key's signature over that hash, the
 *     certificate of the key), one `TRANSCRIPT_REVISED` audit row in the same unit of work, and
 *     one record appended to the package's `transcript-revisions.json`, which carries the body.
 *
 * ONE UNIT OF WORK (operation 85). The engine host's unit: the head of the chain is read and
 * compared with `baseRevision` INSIDE the transaction that mints `revision_no = head + 1`
 * (SEC35-21); two revisions racing for a number are separated by the primary key (the store's
 * 23505 -> `409 TRANSCRIPT_REVISION_CONFLICT`). The audit row is the unit's.
 *
 * THE TABLE IS THE JOURNAL (closing pass F-X, finding R80-08; code review row 80). The order of an
 * append, all of it under the package's lock (`withRevisionLock`: one append of a package at a time):
 *   1. inside the unit: the stored chain is read and the two list files are SETTLED against it
 *      (`settleRevisionFiles`: a staged list of an earlier commit is promoted, any other is removed,
 *      records the table never recorded are removed) - so no append builds on a stale list;
 *   2. the row and the audit row are written;
 *   3. the WHOLE next list is written to the STAGED name and synced; the real list is not touched.
 *      A staged list that cannot be written rolls the rows back;
 *   4. the unit commits;
 *   5. the staged list is renamed over the real one.
 * A commit that fails leaves the real list byte-identical; the staged list is removed at once (the
 * committed rows are read again and the files settled), or at the next append, or at the next start.
 * A rename that fails after the commit (or a crash between the two) leaves the revision STORED and
 * its record in the staged list: operation 86 answers it from there, and the next append or the
 * boot step `transcripts.heads` finishes the rename. NOT HEALABLE, and said so in the error log: a
 * stored row whose record is in neither file - no column stores a revision's body, and none is made up.
 *
 * AFTER THE UNIT COMMITTED operation 85 moves `transcript.revision` of the item in the replicated
 * `evidence` slice (C3 "publishes `evidence`") through the engine's fact door
 * (`noteTranscriptRevision`, pass D6): the head only - the state and the counts the seal signed
 * stay (R80-11). A publication that fails is logged and never turns a stored revision into an
 * error; operation 84 answers the current revision from the table.
 *
 * THE CASE SCOPE (R93-02, D178): operations 84, 85 and 86 refuse a REAL item to a caller who does
 * not hold its case and is no SUPERVISOR (`holdScope` below; the predicate of `src/media-stream`).
 *
 * FAILURES. A refusal is an `ApiFailure` with a code the registry documents. What is not the
 * caller's doing - a package file that is missing or is not the sealed one, a list that does not
 * continue the stored chain, a signing key that cannot be loaded - is logged with the request's
 * logger AND appended to the persistent error log (code, item, never a hash or a text), and the
 * caller is told `503 NOT_READY` with a reason code.
 */
import {
  API_PAGE_LIMIT_DEFAULT,
  ApiErrorCode,
  PageQuerySchema,
  TranscriptDocumentSchema,
  TranscriptRevisionPageSchema,
  TranscriptRevisionRequestSchema,
  TranscriptRevisionSchema,
  findCoreApiOperation,
  type CoreApiRegistryOperation,
  type TranscriptDocumentBody,
  type TranscriptRevisionBody,
  type TranscriptRevisionPage,
} from '@dems/shared/api';
import type { TranscriptRevisionRecord } from '@dems/shared/evidence-verify';
import { AuditType, Permission, Severity, type EvidenceItem } from '@dems/shared/sim';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { LoadedSigner } from '../../capture';
import { factDoorsOf } from '../../engine';
import { sessionPackageDir } from '../../evidence-verify';
import { ApiFailure, invalidInput } from '../../plugins/error-envelope';
import { describeError, principalReference } from '../../plugins/logger';
import { EVIDENCE_CASE_SCOPE_REASON, holdsCase } from '../../media-stream';
import { routeOfOperation } from '../../plugins/permission-guard';
import { loadSealingSigner, readSealedTranscriptDocument, type SealedTranscriptDocument } from '../../sealing';
import {
  promoteStagedRevisionList,
  readRevisionList,
  readSealedTranscriptBytes,
  readStagedRevisionRecords,
  retainCertificate,
  settleRevisionFiles,
  stageRevisionList,
  withRevisionLock,
  type RevisionFilesSettlement,
} from '../../transcript-package';
import { changesOfStoredBody, hexOf, revisionBodyOf, revisionDigestOf, revisionIdOf, storableReasonOf, type RevisionBody } from './revision-body';
import { TranscriptStoreError, createTranscriptStore, type SealedTranscript, type TranscriptRevision } from './store';

/** The operations this module answers, in registry order. */
export const TRANSCRIPT_OPERATION_IDS = ['getTranscript', 'createTranscriptRevision', 'listTranscriptRevisions'] as const;
export type TranscriptOperationId = (typeof TRANSCRIPT_OPERATION_IDS)[number];

/** `source` of this module in a log line and in the persistent error log. */
export const TRANSCRIPTS_SOURCE = 'modules.transcripts';
/** Label of the unit of work of operation 85. */
export const REVISION_UNIT_LABEL = 'transcripts.createTranscriptRevision';
/** Label of the unit that writes the `ACCESS_DENIED` row of a case-scope refusal (R93-02). */
export const TRANSCRIPT_DENIED_UNIT = 'transcripts.denied';

/** `details.reason` of the answers that are not a state of the caller's request. */
export const TranscriptReason = {
  /** The item's package does not hold the sealed transcript document (absent, or other bytes). */
  DOCUMENT_UNAVAILABLE: 'TRANSCRIPT_DOCUMENT_UNAVAILABLE',
  /** The package's revision list does not continue the stored chain. */
  REVISIONS_FILE_INCONSISTENT: 'TRANSCRIPT_REVISIONS_FILE_INCONSISTENT',
  /** The Core's signing key could not be loaded: nothing is signed, so nothing is stored. */
  SIGNING_KEY_UNAVAILABLE: 'SIGNING_KEY_UNAVAILABLE',
  /**
   * The table refuses the ID of the signing key (`transcript_revisions_key_id_check`). CLOSED BY
   * MIGRATION 0013 (dbc-7, ruling D162): the rule is the key-id form `^[A-Z0-9][A-Z0-9_-]{0,63}$`,
   * which takes the Core's key `CORE-KEY-EVSIGN-01` and every ID the signer itself admits
   * (`^[A-Z0-9][A-Z0-9-]{2,62}$`), so no key the signer loaded reaches this answer. The branch
   * stays as the NAMED refusal of a rule that should ever disagree with the signer again: nothing
   * is stored, nothing is written into the package, and the cause is in the error log.
   */
  KEY_ID_NOT_STORABLE: 'SIGNING_KEY_ID_NOT_STORABLE',
  /** Operation 85 without a note of 5 to 500 characters. */
  REASON_REQUIRED: 'REVISION_REASON_REQUIRED',
  /** 409: an item of the demonstration data; a Core holds no transcript or revision for it. */
  SIMULATED_ITEM: 'SIMULATED_ITEM',
  /** 409: a REAL item sealed without a machine transcript document. */
  NO_SEALED_TRANSCRIPT: 'NO_SEALED_TRANSCRIPT',
  /** The revision is stored; the summary of the replicated item could not be moved (logged, never answered). */
  REVISION_NOT_PUBLISHED: 'TRANSCRIPT_REVISION_NOT_PUBLISHED',
  /** A change names a segment the machine transcript does not have. */
  SEGMENT_UNKNOWN: 'REVISION_SEGMENT_UNKNOWN',
} as const;

const TEXT = {
  NOT_FOUND: 'Evidence not found.',
  NOT_READY: 'This item was sealed without a machine transcript.',
  NOT_READY_SIMULATED: 'This is an item of the demonstration data: the Core server keeps no transcript and no revisions for it.',
  CONFLICT: 'The transcript revision is based on a revision that is no longer current.',
  UNAVAILABLE: 'The transcript of this item cannot be read right now.',
  SIGNER: 'The Core cannot sign a transcript revision right now.',
  /** The sentence of every audited refusal of the Core (the media route's and operation 88's). */
  NOT_PERMITTED: 'Your role does not allow this action. The attempt was audited.',
} as const;

function operationOf(operationId: TranscriptOperationId): CoreApiRegistryOperation {
  const operation = findCoreApiOperation(operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** The 2xx statuses the registry documents for an operation must be exactly the ones answered here. */
function successOf(operation: CoreApiRegistryOperation, status: number): number {
  const documented = Object.keys(operation.responses).map(Number).filter((code) => code >= 200 && code < 300);
  if (documented.length !== 1 || documented[0] !== status) throw new Error(`the contract documents the successes [${documented.join(', ')}] for ${operation.operationId}; the transcripts module answers ${status}`);
  return status;
}

const notFound = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, TEXT.NOT_FOUND, { details: { simCode: 'NOT_FOUND' } });
/**
 * 409 `TRANSCRIPT_NOT_READY`, with why (pass D6, ruling of D154). `SIMULATED_ITEM`: an item of the
 * demonstration data (no REAL package): a Core stores no transcript and no revision for it - the
 * simulator's own revisions exist only inside a client in Simulated mode. `NO_SEALED_TRANSCRIPT`:
 * a REAL item whose seal committed no machine transcript (STT disabled, or nothing to seal).
 */
const notReady = (item: Pick<EvidenceItem, 'integritySource'>): ApiFailure =>
  item.integritySource === 'REAL'
    ? new ApiFailure(409, ApiErrorCode.TRANSCRIPT_NOT_READY, TEXT.NOT_READY, { details: { reason: TranscriptReason.NO_SEALED_TRANSCRIPT } })
    : new ApiFailure(409, ApiErrorCode.TRANSCRIPT_NOT_READY, TEXT.NOT_READY_SIMULATED, { details: { reason: TranscriptReason.SIMULATED_ITEM } });
const conflict = (currentRevision: number, cause?: unknown): ApiFailure =>
  new ApiFailure(409, ApiErrorCode.TRANSCRIPT_REVISION_CONFLICT, TEXT.CONFLICT, { details: { currentRevision }, ...(cause === undefined ? {} : { cause }) });

/** The constraint of `transcript_revisions` that holds the form of `signature_key_id` (dbc-3 §B.9; the key-id form since migration 0013). */
const KEY_ID_CONSTRAINT = 'transcript_revisions_key_id_check';

/** Loads the key that signs a revision at `now`. Throws when there is none that may sign. */
export type RevisionSignerLoader = (app: FastifyInstance, now: number) => LoadedSigner;
/** The product's loader: the Core's evidence signing key, where the sealing pipeline loads it. */
const loadCoreSigner: RevisionSignerLoader = (app, now) => loadSealingSigner({ dataDir: app.config.dataDir, now });
const signerLoaders = new WeakMap<FastifyInstance, RevisionSignerLoader>();

/**
 * Hands the module another loader of the signing key, for this app: the composition that already
 * holds the Core's signer, or a test. Without it the module loads the key itself at each request.
 */
export function provideRevisionSigner(app: FastifyInstance, loader: RevisionSignerLoader): void {
  signerLoaders.set(app, loader);
}

/** The codes of what settling the list files of a package did or found (R80-08). In a log line and in the persistent error log. */
export const RevisionFilesCode = {
  /** A staged list of a committed revision was renamed over the real list: the rename of that append never happened. */
  STAGED_PROMOTED: 'TRANSCRIPT_REVISION_LIST_PROMOTED',
  /** A staged list was removed: an append that did not commit, a list beside one that is already whole, or no list of this item. */
  STAGED_DISCARDED: 'TRANSCRIPT_REVISION_STAGED_LIST_DISCARDED',
  /** Signed records the table never recorded were removed from the real list. */
  ORPHAN_REMOVED: 'TRANSCRIPT_REVISION_ORPHAN_REMOVED',
  /** A stored revision has no record in the package and no staged list holds it: not healable, nothing is made up. */
  RECORD_MISSING: 'TRANSCRIPT_REVISION_RECORD_MISSING',
  /** The staged list of a committed revision could not be renamed; the next append or the next start does it. */
  NOT_PROMOTED: 'TRANSCRIPT_REVISIONS_FILE_NOT_PROMOTED',
  /** The list files could not be settled (a file system error, or the rows could not be read). */
  NOT_SETTLED: 'TRANSCRIPT_REVISION_FILES_NOT_SETTLED',
} as const;

export interface SettlementLine {
  readonly level: 'error' | 'warn';
  readonly code: string;
  readonly message: string;
  readonly context: Readonly<Record<string, string | number>>;
}

/**
 * What a settlement is worth saying, one line per act: nothing for a package that was consistent.
 * Counts and the kind only - never a hash, an author or a text. A list that lacks a stored row
 * (`records: null`) is NOT a line here: its caller says it once, by its own code.
 */
export function settlementLines(settlement: RevisionFilesSettlement): SettlementLine[] {
  const lines: SettlementLine[] = [];
  if (settlement.staged === 'PROMOTED') lines.push({ level: 'warn', code: RevisionFilesCode.STAGED_PROMOTED, message: 'the staged revision list of a committed revision was renamed over the list of the package: the rename of that append had not happened', context: { staged: settlement.staged } });
  else if (settlement.staged !== 'NONE') {
    lines.push({
      level: settlement.staged === 'DISCARDED_UNACCEPTABLE' ? 'error' : 'warn',
      code: RevisionFilesCode.STAGED_DISCARDED,
      message: settlement.staged === 'DISCARDED_UNACCEPTABLE' ? 'a staged revision list that is not the stored chain of its item was removed from a package' : 'the staged revision list of an append that did not commit was removed from a package',
      context: { staged: settlement.staged },
    });
  }
  if (settlement.orphansRemoved > 0) lines.push({ level: 'error', code: RevisionFilesCode.ORPHAN_REMOVED, message: 'signed revision records that no stored revision vouches for were removed from the revision list of a package: they were never committed', context: { records: settlement.orphansRemoved } });
  return lines;
}

/** Decimal text of a revision number: the cursor of operation 86. */
const CURSOR_REVISION = /^\d{1,9}$/;

/** One page of a list that is newest first: the revisions after `after`, `limit` at most. */
export function pageOfRevisions(newestFirst: readonly TranscriptRevisionBody[], after: number | null, limit: number): TranscriptRevisionPage {
  const rest = after === null ? newestFirst : newestFirst.filter((revision) => revision.number < after);
  const items = rest.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: rest.length > limit && last !== undefined ? String(last.number) : null };
}

/**
 * The records of a package list that the stored chain vouches for: exactly one per stored row, in
 * order, each with the hash of its row. Null when the list does not hold them (a record is
 * missing, or carries another hash). Records AFTER the last stored row are not returned: they are
 * the remains of an append whose unit did not commit.
 */
export function reconciled(records: readonly TranscriptRevisionRecord[], rows: readonly Pick<TranscriptRevision, 'revisionNo' | 'sha256'>[]): TranscriptRevisionRecord[] | null {
  if (records.length < rows.length) return null;
  const kept: TranscriptRevisionRecord[] = [];
  for (const [index, row] of rows.entries()) {
    const record = records[index];
    if (record === undefined || record.revisionNo !== row.revisionNo || record.sha256 !== row.sha256) return null;
    kept.push(record);
  }
  return kept;
}

export function registerTranscriptRoutes(app: FastifyInstance): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const operations = {
    getTranscript: operationOf('getTranscript'),
    createTranscriptRevision: operationOf('createTranscriptRevision'),
    listTranscriptRevisions: operationOf('listTranscriptRevisions'),
  } as const;
  const paramsOf = (operation: CoreApiRegistryOperation) => {
    const pattern = operation.pathParam?.pattern;
    if (pattern === undefined) throw new Error(`the contract gives ${operation.operationId} no path parameter`);
    return z.object({ id: z.string().regex(pattern) });
  };

  /** Logged with the request's logger and appended to the persistent error log. Codes and IDs only. */
  function persist(request: FastifyRequest, code: string, message: string, err: unknown, evidenceId: string): void {
    request.log.error({ err, code, evidenceId }, message);
    app.errorLog.append({ level: 'error', source: TRANSCRIPTS_SOURCE, message, ...(err === null || err === undefined ? {} : describeError(err)), code, context: { evidenceId, requestId: request.id } });
  }
  /** What settling the list files did, in the log and the persistent error log (R80-08). */
  function noteSettlement(request: FastifyRequest, evidenceId: string, settlement: RevisionFilesSettlement): void {
    for (const line of settlementLines(settlement)) {
      request.log[line.level]({ code: line.code, evidenceId, ...line.context }, line.message);
      app.errorLog.append({ level: line.level, source: TRANSCRIPTS_SOURCE, message: line.message, code: line.code, context: { evidenceId, requestId: request.id, ...line.context } });
    }
  }
  const unavailable = (reason: string, cause?: unknown): ApiFailure =>
    new ApiFailure(503, ApiErrorCode.NOT_READY, reason === TranscriptReason.SIGNING_KEY_UNAVAILABLE ? TEXT.SIGNER : TEXT.UNAVAILABLE, { details: { reason }, ...(cause === undefined ? {} : { cause }) });

  /** The item of the committed state, or 404. */
  function itemOf(evidenceId: string): EvidenceItem {
    const item = app.engine.slice('evidence').find((candidate) => candidate.id === evidenceId);
    if (item === undefined) throw notFound();
    return item;
  }

  /**
   * THE CASE SCOPE OF REAL EVIDENCE (code review row 93, finding R93-02; decision D178; D24 Q-SEC-1
   * (a); C3 §3): the sealed transcript of a REAL item and its revisions are for the operator who
   * holds the case (`evidence_items.investigator_id`) and for a SUPERVISOR - THE SAME predicate as
   * operation 88 and the media route (`holdsCase` of `src/media-stream`: one rule, not a copy).
   * Stage 6 has already held the permission of the operation; this is the narrower rule behind it.
   * An item that is not REAL (the simulator's, a demonstration package) is answered as before.
   *
   * THE REFUSAL is the media route's: a place in the denial budget first, then ONE `ACCESS_DENIED`
   * row committed before the answer, then `403 NOT_PERMITTED` with `details.reason:
   * EVIDENCE_CASE_SCOPE`. It is decided BEFORE anything of the transcript is read, so a refusal
   * says nothing about whether a transcript exists.
   */
  async function holdScope(request: FastifyRequest, operationId: TranscriptOperationId, permission: Permission, item: EvidenceItem): Promise<void> {
    if (item.integritySource !== 'REAL') return;
    const { principal } = request;
    // Stage 6 lets an operator through; anything else never reaches a handler of this module.
    if (principal.kind !== 'OPERATOR') throw notFound();
    if (holdsCase(principal, { investigatorId: item.investigatorId })) return;
    await app.denialBudget.consume(request);
    const named = { operationId, permission, role: principal.role, reason: EVIDENCE_CASE_SCOPE_REASON };
    await app.pipeline.run(TRANSCRIPT_DENIED_UNIT, async (unit) => {
      await unit.audit.append({
        type: AuditType.ACCESS_DENIED,
        severity: Severity.WARNING,
        message: `Access denied: ${EVIDENCE_CASE_SCOPE_REASON} (${operationId})`,
        actorId: principal.operatorId,
        deviceId: principal.deviceId,
        evidenceId: item.id,
        details: named,
      });
    });
    request.log.warn({ code: ApiErrorCode.NOT_PERMITTED, source: TRANSCRIPTS_SOURCE, operationId, principal: principalReference(principal), refusedBy: EVIDENCE_CASE_SCOPE_REASON, audited: true }, 'a transcript operation was refused: the caller does not hold the case of the item');
    throw new ApiFailure(403, ApiErrorCode.NOT_PERMITTED, TEXT.NOT_PERMITTED, { details: named });
  }

  /** The item's sealed machine transcript row, or 409: read on the pool, outside a unit. */
  async function sealedTranscriptOf(request: FastifyRequest, item: EvidenceItem): Promise<{ transcript: SealedTranscript; revisions: TranscriptRevision[] }> {
    const found = await app.db.read(
      `${TRANSCRIPTS_SOURCE}.read`,
      async (pool) => {
        const store = createTranscriptStore(pool);
        const transcript = await store.read(item.id);
        return transcript === null ? null : { transcript, revisions: await store.readRevisions(item.id) };
      },
      request,
    );
    if (found === null) throw notReady(item);
    return found;
  }

  /** The sealed document of the item's package: the bytes whose hash the row holds, read as `dems.transcript/1`. */
  async function documentOf(request: FastifyRequest, item: EvidenceItem, transcript: SealedTranscript): Promise<SealedTranscriptDocument> {
    const bytes = await readSealedTranscriptBytes(sessionPackageDir(app.config.mediaStoreDir, item.sessionId), transcript.jsonSha256);
    const document = bytes === null ? null : readSealedTranscriptDocument(bytes);
    if (document === null) {
      persist(request, TranscriptReason.DOCUMENT_UNAVAILABLE, 'the sealed transcript document of an item is not in its package, or is not the sealed one', null, item.id);
      throw unavailable(TranscriptReason.DOCUMENT_UNAVAILABLE);
    }
    return document;
  }

  /** A stored revision as the contract answers it; `changes` come from the signed body of the package record. */
  function revisionAnswer(row: TranscriptRevision, transcript: SealedTranscript, changes: TranscriptRevisionBody['changes']): TranscriptRevisionBody {
    return {
      revisionId: revisionIdOf(row.revisionNo),
      number: row.revisionNo,
      authorId: row.authorId,
      baseRevision: row.revisionNo - 1,
      machineTranscriptHash: transcript.jsonSha256,
      signedBy: row.signatureKeyId,
      signature: { value: row.signatureValue, keyId: row.signatureKeyId, algorithm: row.signatureAlgorithm, simulated: row.signatureSimulated },
      createdAt: row.createdAt,
      changes,
    };
  }

  // 84 getTranscript
  {
    const ok = successOf(operations.getTranscript, 200);
    routes.route({
      ...routeOfOperation(operations.getTranscript),
      schema: { params: paramsOf(operations.getTranscript), response: { [ok]: TranscriptDocumentSchema } },
      handler: async (request): Promise<TranscriptDocumentBody> => {
        const item = itemOf(request.params.id);
        await holdScope(request, 'getTranscript', Permission.EVIDENCE_VIEW, item);
        const { transcript, revisions } = await sealedTranscriptOf(request, item);
        const document = await documentOf(request, item, transcript);
        return {
          documentVersion: document.header.doc_version,
          language: document.header.language,
          speakerState: document.speaker_state,
          segments: document.segments.map((segment) => ({ index: segment.index, startMs: segment.start_ms, endMs: segment.end_ms, text: segment.text, speaker: segment.speaker })),
          // The document as stored IS the sealed machine transcript: one hash, and no revision moves it (OD-15).
          sha256: transcript.jsonSha256,
          machineTranscriptHash: transcript.jsonSha256,
          assembledAt: transcript.createdAt,
          revision: revisions.at(-1)?.revisionNo ?? 0,
        };
      },
    });
  }

  // 85 createTranscriptRevision
  {
    const created = successOf(operations.createTranscriptRevision, 201);
    routes.route({
      ...routeOfOperation(operations.createTranscriptRevision),
      schema: { params: paramsOf(operations.createTranscriptRevision), body: TranscriptRevisionRequestSchema, response: { [created]: TranscriptRevisionSchema } },
      handler: async (request, reply): Promise<TranscriptRevisionBody> => {
        const item = itemOf(request.params.id);
        const { principal } = request;
        // Stage 6 let an operator with TRANSCRIPT_REVISE through; anything else never reaches a handler.
        if (principal.kind !== 'OPERATOR') throw notFound();
        await holdScope(request, 'createTranscriptRevision', Permission.TRANSCRIPT_REVISE, item);
        const { transcript } = await sealedTranscriptOf(request, item);
        const document = await documentOf(request, item, transcript);
        const { baseRevision, changes, note } = request.body;
        const reason = storableReasonOf(note);
        if (reason === null) throw new ApiFailure(422, ApiErrorCode.INVALID_INPUT, 'A transcript revision needs a note of 5 to 500 characters that says why it was made.', { details: { in: 'body', member: 'note', reason: TranscriptReason.REASON_REQUIRED } });
        if (changes.some((change) => change.segmentIndex >= document.segments.length)) {
          throw new ApiFailure(422, ApiErrorCode.INVALID_INPUT, 'A change names a segment the transcript does not have.', { details: { in: 'body', member: 'changes', reason: TranscriptReason.SEGMENT_UNKNOWN, segments: document.segments.length } });
        }

        const now = app.clock.now();
        let signer: LoadedSigner;
        try {
          signer = (signerLoaders.get(app) ?? loadCoreSigner)(app, now);
        } catch (err) {
          persist(request, TranscriptReason.SIGNING_KEY_UNAVAILABLE, 'the signing key of the Core could not be loaded for a transcript revision', err, item.id);
          throw unavailable(TranscriptReason.SIGNING_KEY_UNAVAILABLE, err);
        }
        const packageDir = sessionPackageDir(app.config.mediaStoreDir, item.sessionId);
        const authorId = principal.operatorId;

        const identity = { evidenceId: item.id, machineTranscriptSha256: transcript.jsonSha256 };
        /** True once the staged list of THIS append was (being) written: only then is there anything to settle after a failure. */
        const progress = { staged: false };
        const runUnit = () =>
          app.engine.run(REVISION_UNIT_LABEL, async (scope) => {
            const store = createTranscriptStore(scope.unit);
            let stored: TranscriptRevision[];
            try {
              stored = await store.readRevisions(item.id);
            } catch (err) {
              persist(request, 'TRANSCRIPT_REVISIONS_READ_FAILED', 'the stored revisions of an item could not be read', err, item.id);
              throw err;
            }
            const head = stored.at(-1);
            const currentRevision = head?.revisionNo ?? 0;
            // SEC35-21: compared inside the transaction that mints the number.
            if (baseRevision !== currentRevision) throw conflict(currentRevision);

            // The two list files against the chain this unit reads: no append builds on a stale list.
            let kept: TranscriptRevisionRecord[] | null;
            try {
              const settlement = await settleRevisionFiles(packageDir, identity, stored);
              noteSettlement(request, item.id, settlement);
              kept = settlement.records;
            } catch (err) {
              persist(request, RevisionFilesCode.NOT_SETTLED, 'the revision list files of a package could not be settled against the stored chain; no revision is appended', err, item.id);
              throw unavailable(TranscriptReason.REVISIONS_FILE_INCONSISTENT, err);
            }
            if (kept === null) {
              persist(request, TranscriptReason.REVISIONS_FILE_INCONSISTENT, 'the revision list of a package does not continue the stored chain; no revision is appended', null, item.id);
              throw unavailable(TranscriptReason.REVISIONS_FILE_INCONSISTENT);
            }

            const body: RevisionBody = revisionBodyOf({ evidenceId: item.id, baseRevision, parentSha256: head?.sha256 ?? transcript.jsonSha256, machineTranscriptSha256: transcript.jsonSha256, authorId, reason, createdAt: now, changes });
            const digest = revisionDigestOf(body);
            let signatureValue: string;
            try {
              signatureValue = hexOf(new Uint8Array(await signer.signer.sign(digest)));
            } catch (err) {
              persist(request, TranscriptReason.SIGNING_KEY_UNAVAILABLE, 'the Core key did not sign a transcript revision', err, item.id);
              throw unavailable(TranscriptReason.SIGNING_KEY_UNAVAILABLE, err);
            }
            const sha256 = hexOf(digest);

            let row: TranscriptRevision;
            try {
              row = await store.appendRevision({
                evidenceId: item.id,
                baseRevision,
                parentSha256: body.parentSha256,
                sha256,
                authorId,
                reason,
                signatureValue,
                signatureKeyId: signer.signer.keyId,
                signatureAlgorithm: 'Ed25519',
                signatureSimulated: false,
                signatureCertificateSha256: signer.certificate.sha256,
                createdAt: now,
              });
            } catch (err) {
              if (err instanceof TranscriptStoreError && err.code === 'TRANSCRIPT_REVISION_CONFLICT') throw conflict(currentRevision, err);
              if (err instanceof TranscriptStoreError && err.code === 'TRANSCRIPT_NOT_FOUND') throw notReady(item);
              if (err instanceof TranscriptStoreError && err.constraint === KEY_ID_CONSTRAINT) {
                persist(request, TranscriptReason.KEY_ID_NOT_STORABLE, 'the table of transcript revisions refuses the ID of the signing key; no revision is stored', err, item.id);
                throw unavailable(TranscriptReason.KEY_ID_NOT_STORABLE, err);
              }
              persist(request, 'TRANSCRIPT_REVISION_NOT_STORED', 'a transcript revision could not be stored', err, item.id);
              throw err;
            }

            // C3 §5.2: the revision id, who, the numbers and the binding hash. NEVER a segment text.
            await scope.unit.audit.append({
              type: 'TRANSCRIPT_REVISED',
              message: `Transcript of ${item.id} revised (revision ${row.revisionNo})`,
              actorId: authorId,
              deviceId: principal.deviceId,
              sessionId: item.sessionId,
              evidenceId: item.id,
              details: { revisionId: revisionIdOf(row.revisionNo), authorId, number: row.revisionNo, baseRevision, changeCount: changes.length, machineTranscriptHash: transcript.jsonSha256, reason },
            });

            // The package record, LAST, and only STAGED: both rows were accepted. A staged list that cannot be written undoes them.
            const record: TranscriptRevisionRecord = {
              revisionNo: row.revisionNo,
              parentSha256: body.parentSha256,
              sha256,
              authorId: body.authorId,
              reason: body.reason,
              createdAt: body.createdAt,
              signature: { algorithm: 'Ed25519', keyId: signer.signer.keyId, value: signatureValue, certificateSha256: signer.certificate.sha256 },
              body: body as unknown as NonNullable<TranscriptRevisionRecord['body']>,
            };
            try {
              await retainCertificate(packageDir, signer.certificate);
              progress.staged = true;
              await stageRevisionList(packageDir, { ...identity, revisions: [...kept, record] });
            } catch (err) {
              persist(request, 'TRANSCRIPT_REVISIONS_FILE_NOT_WRITTEN', 'the revision list of a package could not be written; the revision is not stored', err, item.id);
              throw unavailable(TranscriptReason.REVISIONS_FILE_INCONSISTENT, err);
            }
            return revisionAnswer(row, transcript, changes);
            });
        // ONE APPEND OF A PACKAGE AT A TIME (R80-08): settling, the staged list, the commit and the rename.
        const outcome = await withRevisionLock(packageDir, async () => {
          let committed: Awaited<ReturnType<typeof runUnit>>;
          try {
            committed = await runUnit();
          } catch (failure) {
            // The unit did not commit (as far as this process was told). THE TABLE JUDGES the staged list: the committed
            // rows are read again and the files settled - removed when the row is not there, promoted when it is.
            if (progress.staged) {
              try {
                const rows = await app.db.read(`${TRANSCRIPTS_SOURCE}.settle`, (pool) => createTranscriptStore(pool).readRevisions(item.id), request);
                noteSettlement(request, item.id, await settleRevisionFiles(packageDir, identity, rows));
              } catch (err) {
                persist(request, RevisionFilesCode.NOT_SETTLED, 'the staged revision list of an append that did not commit could not be settled; the next append or the next start settles it', err, item.id);
              }
            }
            throw failure;
          }
          // AFTER THE COMMIT: the staged list becomes the list. A rename that fails never turns a stored revision into
          // an error: operation 86 answers from the staged list, and the next append or the next start renames it.
          try {
            await promoteStagedRevisionList(packageDir);
          } catch (err) {
            persist(request, RevisionFilesCode.NOT_PROMOTED, 'the staged revision list of a committed revision could not be renamed over the list of the package', err, item.id);
          }
          return committed;
        });
        // Pass D6: the revision is committed. The item's transcript summary of slice `evidence` now names the
        // new head, so a client that watches the slice sees it without a reload (C3 §2.3 "publishes
        // evidence"). A unit of its own: a publication that fails never turns a stored revision into an error.
        try {
          await factDoorsOf(app.engine).noteTranscriptRevision({
            evidenceId: item.id,
            revision: outcome.value.number,
            state: document.header.state === 'ASSEMBLED' ? 'READY' : 'PARTIAL',
            machineTranscriptHash: transcript.jsonSha256,
            labelsStatus: transcript.labelsStatus,
          });
        } catch (err) {
          persist(request, TranscriptReason.REVISION_NOT_PUBLISHED, 'a stored transcript revision was not published in the evidence slice; operation 84 answers the head from the table', err, item.id);
        }
        void reply.code(created);
        return outcome.value;
      },
    });
  }

  // 86 listTranscriptRevisions
  {
    const ok = successOf(operations.listTranscriptRevisions, 200);
    routes.route({
      ...routeOfOperation(operations.listTranscriptRevisions),
      schema: { params: paramsOf(operations.listTranscriptRevisions), querystring: PageQuerySchema, response: { [ok]: TranscriptRevisionPageSchema } },
      handler: async (request): Promise<TranscriptRevisionPage> => {
        const item = itemOf(request.params.id);
        await holdScope(request, 'listTranscriptRevisions', Permission.EVIDENCE_VIEW, item);
        const { cursor, limit } = request.query;
        const after = cursor === undefined ? null : CURSOR_REVISION.test(cursor) ? Number(cursor) : Number.NaN;
        if (Number.isNaN(after)) throw invalidInput('querystring');
        const { transcript, revisions } = await sealedTranscriptOf(request, item);
        if (revisions.length === 0) return { items: [], nextCursor: null };
        const list = await readRevisionList(sessionPackageDir(app.config.mediaStoreDir, item.sessionId), { evidenceId: item.id, machineTranscriptSha256: transcript.jsonSha256 });
        // Between a commit and its rename the record of the newest revision is in the STAGED list (R80-08): read, never written here.
        const records = (list === null ? null : reconciled(list.revisions, revisions)) ?? (await readStagedRevisionRecords(sessionPackageDir(app.config.mediaStoreDir, item.sessionId), { evidenceId: item.id, machineTranscriptSha256: transcript.jsonSha256 }, revisions));
        const answers: TranscriptRevisionBody[] = [];
        for (const [index, row] of revisions.entries()) {
          // The changes are answered from the body whose hash is the stored, signed hash of the row - or not at all.
          const changes = records === null ? null : changesOfStoredBody(records[index]?.body, { evidenceId: item.id, revisionNo: row.revisionNo, sha256: row.sha256 });
          if (changes === null) {
            persist(request, TranscriptReason.REVISIONS_FILE_INCONSISTENT, 'the revision list of a package does not hold the signed body of a stored revision', null, item.id);
            throw unavailable(TranscriptReason.REVISIONS_FILE_INCONSISTENT);
          }
          answers.push(revisionAnswer(row, transcript, [...changes]));
        }
        return pageOfRevisions(answers.reverse(), after, limit ?? API_PAGE_LIMIT_DEFAULT);
      },
    });
  }
}
