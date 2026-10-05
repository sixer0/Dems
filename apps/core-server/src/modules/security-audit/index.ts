/**
 * Security-audit module (plan row W39; spec §7.13, §7.2, §7.3, §7.17 members 23 to 25, §7.18;
 * SR-78, SR-81; AC-B-87, AC-B-88): operations 58 to 63 of the shared registry.
 *
 *   #   operationId        method and path               access (registry)   audit on success
 *   58  getSecurityStatus  GET  /api/v1/security/status  AUTHENTICATED       none (a read)
 *   59  listAuditRows      GET  /api/v1/audit            AUTHENTICATED       none (a read)
 *   60  verifyAuditChain   GET  /api/v1/audit/chain      AUTHENTICATED       none (a read)
 *   61  exportAudit        POST /api/v1/audit/export     AUDIT_EXPORT        AUDIT_EXPORTED
 *   62  exportLogs         POST /api/v1/logs/export      AUDIT_EXPORT        AUDIT_EXPORTED, scope LOGS
 *   63  listEvents         GET  /api/v1/events           AUTHENTICATED       none (a read)
 *
 * Method, path and schemas are the registry's: each route is built from its registry entry.
 *
 * WHO MAY CALL is not checked here. The access rule of the registry is applied by stage 6
 * (`plugins/permission-guard`) before the body is read, and it also writes the one row of a
 * refused export (decision D83 DN-4). This folder reads no role, no session and no device.
 *
 * WHERE EACH ANSWER COMES FROM
 *
 *   58  the slice `security` of the engine's committed state, and the STORED head of the audit
 *       chain: its hash and its sequence, one row of one statement (`reads.ts`). Not the ring's:
 *       the ring holds the newest 1,000 rows, the table holds all.
 *   59  PostgreSQL: one page in one read-only snapshot, by the keyset `seq` (`reads.ts`,
 *   63  `cursor.ts`). A cursor that names no row of the table (a reset discarded its chain)
 *       answers 422 `INVALID_INPUT`, the contract's "a cursor that is not one".
 *   60  three things. `view`: the hosted action `verifyAuditChain`, the shared check over the
 *       engine's ring (what the demo fault AUDIT_TAMPER breaks). `stored`: the stored-chain
 *       check over the table, incremental, one run for calls that arrive together
 *       (`stored-chain.ts`). `lineage`: the newest 20 chains that resets discarded, newest
 *       first, with their count.
 *   61  hosted actions of the shared simulator: one call of `app.engine.command` under the
 *   62  caller's identity, one unit of work, the answer after the commit; the engine's unit
 *       gives it the state position of API-7 (`src/engine/api-headers.ts`). The engine host writes the AUDIT_EXPORTED row and the record in
 *       `exports` (derived from that row). The module writes no row, and NO FILE: the contract
 *       says of both operations that the answer holds none and that a client builds it from the
 *       pages of 59 and 63.
 *
 * THE ANSWER OF AN EXPORT names the chain the export covers: `rows` is the number of stored
 * rows before the AUDIT_EXPORTED row and `head` is the hash of the last of them, both taken
 * from that row itself (its sequence minus one, and its `prevHash`). So a client that walks
 * operation 59 up to `rows` ends on a row whose hash is `head`.
 *
 * A refusal the simulator reports IN ITS RESULT is answered AFTER the unit has ended: such a
 * result may have written a row.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 *
 * CONTRACT with the scaffold (P25: `app.ts` is frozen): `securityAuditModule` keeps its name.
 */
import {
  API_PAGE_LIMIT_DEFAULT,
  AUDIT_CHAIN_LINEAGE_MAX,
  AuditChainStatusSchema,
  AuditExportAcceptedSchema,
  AuditExportScope,
  AuditListQuerySchema,
  AuditPageSchema,
  EventListQuerySchema,
  EventPageSchema,
  SecurityStatusSchema,
  findCoreApiOperation,
  type AuditChainStatus,
  type AuditExportAccepted,
  type AuditPage,
  type CoreApiRegistryOperation,
  type EventPage,
  type SecurityStatus,
} from '@dems/shared/api';
import type { AuditRow, ExportResult } from '@dems/shared/sim';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiFailure, invalidInput } from '../../plugins/error-envelope';
import { routeOfOperation } from '../../plugins/permission-guard';
import { decodeAuditCursor, decodeEventCursor, encodeAuditCursor, encodeEventCursor, type AuditCursor, type EventCursor } from './cursor';
import { NO_REASON, readAuditExportBody } from './export-request';
import { readAuditPage, readEventPage, readLineage, readStoredHead } from './reads';
import { createStoredChainVerifier, type StoredChainStats } from './stored-chain';

export { createStoredChainVerifier, type StoredChainStats, type StoredChainStatus, type StoredChainVerifier } from './stored-chain';

/** The operations this module answers, in registry order of their numbers (58 to 63). */
export const SECURITY_AUDIT_MODULE_OPERATIONS = ['getSecurityStatus', 'listAuditRows', 'verifyAuditChain', 'exportAudit', 'exportLogs', 'listEvents'] as const;
export type SecurityAuditModuleOperation = (typeof SECURITY_AUDIT_MODULE_OPERATIONS)[number];

/** The audit type of the row an accepted export writes, and the detail that names the export. */
const EXPORT_ROW_TYPE = 'AUDIT_EXPORTED';
const EXPORT_ROW_ID = 'exportId';

type ExportRefusal = Extract<ExportResult, { ok: false }>;

/**
 * The answer of a refusal that the hosted action reports in its result. Fixed texts; none quotes
 * the request. The audit and the log export refuse for three reasons, in this order: no operator,
 * no right, no reason. A refusal for want of the right is `NOT_PERMITTED` on these two
 * operations (RB-5), whatever the simulator calls it; it is stage 6 that refuses such a caller,
 * and that line is only reached when the right went away between stage 6 and the unit. Any other
 * reason is one of the evidence export, which this action never gives: a defect, answered as one.
 */
function exportRefused(refusal: ExportRefusal): Error {
  switch (refusal.reason) {
    case 'NOT_SIGNED_IN':
      return new ApiFailure(401, 'NOT_SIGNED_IN', 'Sign in first.');
    case 'FORBIDDEN':
      return new ApiFailure(403, 'NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.');
    case 'INVALID_REASON':
      return new ApiFailure(422, 'INVALID_REASON', 'An export reason of at least 5 characters is required.', { details: { simCode: 'REASON_TOO_SHORT' } });
    default:
      return new Error('the audit export was refused for a reason it does not have');
  }
}

/** What a test or a measurement may ask of the module: the counters of its stored-chain check. */
export interface SecurityAuditControl {
  storedChainStats(): StoredChainStats;
}

const CONTROLS = new WeakMap<FastifyInstance, SecurityAuditControl>();

/** The module's counters of an app. For tests and measurements; no handler needs it. */
export function securityAuditControl(app: FastifyInstance): SecurityAuditControl {
  const control = CONTROLS.get(app);
  if (control === undefined) throw new Error('this app has no security-audit module');
  return control;
}

/** The registry entry of one of this module's operations. A missing one stops the start. */
function operationOf(operationId: SecurityAuditModuleOperation): CoreApiRegistryOperation {
  const operation = findCoreApiOperation(operationId);
  if (operation === undefined) throw new Error(`the contract registry has no operation ${operationId}`);
  return operation;
}

/** The row an accepted export wrote, among the newest rows of the committed ring. */
function exportRowOf(ring: readonly AuditRow[], exportId: string): AuditRow {
  for (let index = ring.length - 1; index >= 0; index -= 1) {
    const row = ring[index];
    if (row !== undefined && row.type === EXPORT_ROW_TYPE && row.details[EXPORT_ROW_ID] === exportId) return row;
  }
  // The command resolved after its commit, and the ring holds what was committed.
  throw new Error('an accepted export left no row in the committed audit ring');
}

export const securityAuditModule: FastifyPluginAsync = async (app) => {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const operations = {
    getSecurityStatus: operationOf('getSecurityStatus'),
    listAuditRows: operationOf('listAuditRows'),
    verifyAuditChain: operationOf('verifyAuditChain'),
    exportAudit: operationOf('exportAudit'),
    exportLogs: operationOf('exportLogs'),
    listEvents: operationOf('listEvents'),
  } as const satisfies Record<SecurityAuditModuleOperation, CoreApiRegistryOperation>;

  /**
   * One verifier per server: what it remembers is of the chain the server reads now. A start, a
   * reset, a scenario load and a resync move the engine's epoch, and a reset reopens the pool.
   */
  const storedChain = createStoredChainVerifier({
    chain: () => `${app.engine.epoch}:${app.db.generation}`,
    log: app.log,
    errorLog: app.errorLog,
  });
  CONTROLS.set(app, { storedChainStats: () => storedChain.stats() });

  /** Hosted `exportAudit` or `exportLogs`: the body, the action, the refusal after the unit, the answer. */
  async function runExport(request: FastifyRequest, reply: FastifyReply, action: 'exportAudit' | 'exportLogs', scope: AuditExportScope): Promise<AuditExportAccepted> {
    // Line 8 of the precedence table: a body that does not match its schema, before the engine.
    const body = readAuditExportBody(request.body);
    if (body.kind === 'INVALID') throw invalidInput('body');
    // Line 10: a missing or too-short reason is the action's to refuse, in its own order.
    const outcome = await app.engine.command(request.principal, action, body.kind === 'VALID' ? body.request : NO_REASON);
    // The unit has ended. A refusal in the result is answered only now: it may have written a row.
    const result = outcome.value;
    if (!result.ok) throw exportRefused(result);
    const row = exportRowOf(app.engine.slice('audit').rows, result.exportId);
    void reply.code(202);
    return { exportId: result.exportId, scope, rows: row.seq - 1, head: row.prevHash };
  }

  // 58 getSecurityStatus
  routes.route({
    ...routeOfOperation(operations.getSecurityStatus),
    schema: { response: { 200: SecurityStatusSchema } },
    handler: async (request): Promise<SecurityStatus> => {
      const security = app.engine.slice('security');
      const head = await app.db.read('securityAudit.getSecurityStatus', readStoredHead, request);
      return { security, auditHead: head.hash, auditTotal: head.seq };
    },
  });

  // 59 listAuditRows
  routes.route({
    ...routeOfOperation(operations.listAuditRows),
    schema: { querystring: AuditListQuerySchema, response: { 200: AuditPageSchema } },
    handler: async (request): Promise<AuditPage> => {
      const { category, type, actorId, sessionId, evidenceId, order, cursor, limit } = request.query;
      let after: AuditCursor | undefined;
      if (cursor !== undefined) {
        // A value that has the form of a cursor but is none of this list: "a cursor that is not one".
        const position = decodeAuditCursor(cursor);
        if (position === null) throw invalidInput('querystring');
        after = position;
      }
      const page = await app.db.read('securityAudit.listAuditRows', (pool) => readAuditPage(pool, { category, type, actorId, sessionId, evidenceId, order: order ?? 'ASC', after, limit: limit ?? API_PAGE_LIMIT_DEFAULT }), request);
      // The cursor's row is not in the table: the chain it was taken from is gone.
      if (page.kind === 'CURSOR_UNKNOWN') throw invalidInput('querystring');
      return { rows: page.rows, head: page.head.hash, total: page.head.seq, nextCursor: page.next === null ? null : encodeAuditCursor(page.next) };
    },
  });

  // 60 verifyAuditChain: a GET. The hosted action reads the engine's ring and writes nothing.
  routes.route({
    ...routeOfOperation(operations.verifyAuditChain),
    schema: { response: { 200: AuditChainStatusSchema } },
    handler: async (request): Promise<AuditChainStatus> => {
      const view = await app.engine.command(request.principal, 'verifyAuditChain');
      const stored = await app.db.read('securityAudit.verifyAuditChain', (pool) => storedChain.status(pool), request);
      const lineage = await app.db.read('securityAudit.verifyAuditChain', (pool) => readLineage(pool, AUDIT_CHAIN_LINEAGE_MAX), request);
      return { view: view.value, stored, lineage: lineage.entries, lineageTotal: lineage.total };
    },
  });

  // 61 exportAudit: hosted `exportAudit`. The body is validated here, to answer the two 422 codes in the specification's order.
  routes.route({
    ...routeOfOperation(operations.exportAudit),
    schema: { response: { 202: AuditExportAcceptedSchema } },
    handler: (request, reply): Promise<AuditExportAccepted> => runExport(request, reply, 'exportAudit', AuditExportScope.AUDIT),
  });

  // 62 exportLogs: hosted `exportLogs`: the same row with `scope: LOGS`.
  routes.route({
    ...routeOfOperation(operations.exportLogs),
    schema: { response: { 202: AuditExportAcceptedSchema } },
    handler: (request, reply): Promise<AuditExportAccepted> => runExport(request, reply, 'exportLogs', AuditExportScope.LOGS),
  });

  // 63 listEvents
  routes.route({
    ...routeOfOperation(operations.listEvents),
    schema: { querystring: EventListQuerySchema, response: { 200: EventPageSchema } },
    handler: async (request): Promise<EventPage> => {
      const { category, type, severity, cursor, limit } = request.query;
      let after: EventCursor | undefined;
      if (cursor !== undefined) {
        const position = decodeEventCursor(cursor);
        if (position === null) throw invalidInput('querystring');
        after = position;
      }
      const page = await app.db.read('securityAudit.listEvents', (pool) => readEventPage(pool, { category, type, severity, after, limit: limit ?? API_PAGE_LIMIT_DEFAULT }), request);
      if (page.kind === 'CURSOR_UNKNOWN') throw invalidInput('querystring');
      return { events: page.events, nextCursor: page.next === null ? null : encodeEventCursor(page.next) };
    },
  });
};
