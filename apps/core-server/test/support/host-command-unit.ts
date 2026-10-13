/**
 * A unit of work and the audit writer on a pool of their own, OUTSIDE the Fastify app (task 4,
 * blueprint row 214: the gate of row 215; security review SX-02, SX-03, hypothesis H2). Test
 * support, not a test file and not a product file.
 *
 * WHAT IT IS. The way a host command (`operator:set-password`, row 215) would open the Core's
 * pipeline while the Core is stopped: no `buildApp`, no engine, no realtime hub, no boot step, no
 * listener, no lane lock. It builds exactly four things and hands them to the Core's own
 * `createPipeline`:
 *
 *   the pool      `createRuntimePool(connection)` of `plugins/db`: the runtime role's pool as the
 *                 server builds it (the pinned search path in the start-up packet, finding F53);
 *   the clock     `createSystemClock()` of `core/clock`, or the one a test passes;
 *   the log       an object with the six level methods the pipeline and the two writers call
 *                 (`debug`, `info`, `warn`, `error`; `trace`, `fatal` for completeness). It
 *                 records what it is given, so a test can sweep it for a secret;
 *   the error log an object with `append`: the same, recorded.
 *
 * Nothing else is needed: `PipelineDependencies` (`core/pipeline.ts`) has no other required
 * member, and `AuditWriterDependencies` (`core/audit-writer.ts`) is the clock, the log and the
 * error log.
 *
 * WHAT THE WORK FUNCTION GETS is the pipeline's own `UnitContext`: `unit.query` for the row
 * statements of the command, `unit.audit.append` for its one audit row. The unit opens with
 * `BEGIN`, the chain lock and the transaction settings, and ends with one `COMMIT`
 * (`core/unit-of-work.ts`); the row is built by the shared code and inserted by the writer.
 *
 * THE CORE'S OWN VERIFICATION, also without an app: `createStoredChainVerifier` of the
 * security-audit module, which calls the boot checks' `checkStoredChain` and the mapping module's
 * `verifyStoredAuditRows`. `verifyStoredChain()` runs a full pass on this pool.
 *
 * FOR ROW 215. The four members above are what the command has to construct. The recording log
 * and error log here are doubles: the command needs real ones of its own choice (the error log
 * factory `createErrorLog(file | null)` of `plugins/logger` takes no app either).
 */
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import type { DatabaseConnection } from '../../src/config';
import { createSystemClock, type Clock } from '../../src/core/clock';
import { createPipeline } from '../../src/core/pipeline';
import type { Pipeline } from '../../src/core/types';
import { createStoredChainVerifier, type StoredChainStatus } from '../../src/modules/security-audit/stored-chain';
import { createRuntimePool } from '../../src/plugins/db';
import type { ErrorLog, ErrorLogEntry } from '../../src/plugins/logger';

/** One call of the log, as it was made. */
export interface HostLogLine {
  readonly level: string;
  readonly object: unknown;
  readonly message: string | null;
}

export interface HostCommandUnitOptions {
  /** Stamps the audit row. Default: the server clock of `core/clock`. */
  readonly clock?: Clock;
}

export interface HostCommandUnit {
  /** The runtime role's pool of this harness. Nobody else's. */
  readonly pool: Pool;
  /** The Core's own serial unit-of-work queue, on that pool. */
  readonly pipeline: Pipeline;
  /** Every line the pipeline and the writers logged. */
  readonly logLines: HostLogLine[];
  /** Every entry they handed to the persistent error log. */
  readonly errorEntries: ErrorLogEntry[];
  /** The Core's own stored-chain check, a full pass, on this pool. */
  verifyStoredChain(): Promise<StoredChainStatus>;
  /** Drains the pipeline and ends the pool. A second call does nothing. */
  close(): Promise<void>;
}

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

function recordingLog(lines: HostLogLine[]): FastifyBaseLogger {
  const log: Record<string, unknown> = { level: 'trace', silent: () => undefined };
  for (const level of LEVELS) {
    log[level] = (first: unknown, second?: unknown) => {
      if (typeof first === 'string') lines.push({ level, object: null, message: first });
      else lines.push({ level, object: first, message: typeof second === 'string' ? second : null });
    };
  }
  log['child'] = () => log;
  return log as unknown as FastifyBaseLogger;
}

/**
 * Opens the pipeline the way a host command would: on a pool of its own, as the role of
 * `connection` (the runtime role `dems_app` in every use of row 214).
 */
export function openHostCommandUnit(connection: DatabaseConnection, options: HostCommandUnitOptions = {}): HostCommandUnit {
  const logLines: HostLogLine[] = [];
  const errorEntries: ErrorLogEntry[] = [];
  const log = recordingLog(logLines);
  const errorLog: ErrorLog = { file: null, append: (entry) => void errorEntries.push(entry) };
  const pool = createRuntimePool(connection);
  // An idle connection that fails must not stop the process; the next statement reports it.
  pool.on('error', () => undefined);
  const pipeline = createPipeline({ pool: () => pool, clock: options.clock ?? createSystemClock(), log, errorLog });
  // One chain for the life of this harness: the first call is the full pass.
  const verifier = createStoredChainVerifier({ chain: () => 'host-command-unit', log, errorLog });
  let closed: Promise<void> | null = null;
  return {
    pool,
    pipeline,
    logLines,
    errorEntries,
    verifyStoredChain: () => verifier.status(pool),
    close() {
      closed ??= pipeline.close().then(() => pool.end());
      return closed;
    },
  };
}
