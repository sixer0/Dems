/**
 * What a reset writes beyond the seed, decided from what R-3 read (plan row W29; database
 * contract §8.5 R-3, R-5b, R-5e, R-5f; §4.30; LN-1 to LN-3; decisions D14, D16, D18).
 *
 * Pure: no database, no clock, no file. The routine reads the old database once (R-3), passes
 * the facts here, and writes exactly what this module returns.
 *
 *   the epoch        continues: the previous value plus 1; 0 for a first build (SPEC-GAP-5);
 *   the lineage row  one, for the chain being discarded, when the old audit log had at least
 *                    one row (LN-1); its values are what R-3 read and what the caller supplied
 *                    (LN-2);
 *   SCENARIO_LOADED  one audit row and one event in the new chain, whose details name the head
 *                    and the row count of the discarded chain (DC-7, LN-3).
 *
 * Every number that comes out of a `bigint` column stays decimal TEXT here (the lineage row is
 * written with `$n::bigint`), except the two values the shared code needs as numbers: the new
 * epoch and `previousRows`. Both are checked to be safe integers.
 */
import { GENESIS_HASH, isScenarioName, type ActivityInput } from '@dems/shared/sim';
import { CHAIN_DISCARD_REASON, SCENARIO, type ChainDiscardReason, type ScenarioValue } from '../schema';
import { ResetError } from './errors';

/** What the caller asks for. `actorId` is null from the command line (DC-9). */
export interface ResetRequest {
  readonly scenario: ScenarioValue;
  readonly reason: ChainDiscardReason;
  readonly actorId: string | null;
}

export interface ResetRequestInput {
  readonly scenario?: string | undefined;
  readonly reason?: string | undefined;
  readonly actorId?: string | null | undefined;
}

const OPERATOR_ID = /^OPR-[0-9]{3}$/;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/;
const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Checks the caller's options before anything is opened. Defaults: scenario `idle`, reason
 * `RESET`, no actor. The message names the option, never its value.
 */
export function resolveRequest(input: ResetRequestInput): ResetRequest {
  const scenario = input.scenario ?? 'idle';
  const reason = input.reason ?? 'RESET';
  const actorId = input.actorId ?? null;
  if (!isScenarioName(scenario) || !(SCENARIO as readonly string[]).includes(scenario)) {
    throw new ResetError('RESET_OPTIONS_INVALID', 'R-0', `refused: scenario must be one of ${SCENARIO.join(', ')}.`);
  }
  if (!(CHAIN_DISCARD_REASON as readonly string[]).includes(reason)) {
    throw new ResetError('RESET_OPTIONS_INVALID', 'R-0', `refused: reason must be one of ${CHAIN_DISCARD_REASON.join(', ')}.`);
  }
  if (actorId !== null && !OPERATOR_ID.test(actorId)) {
    throw new ResetError('RESET_OPTIONS_INVALID', 'R-0', 'refused: the actor must be an operator identifier (OPR-nnn) or absent.');
  }
  return { scenario, reason: reason as ChainDiscardReason, actorId };
}

/** The reset's `now`: read once from the clock, a positive whole number of milliseconds (DR-1). */
export function assertNow(now: unknown): number {
  if (typeof now !== 'number' || !Number.isSafeInteger(now) || now <= 0) {
    throw new ResetError('RESET_OPTIONS_INVALID', 'R-1', 'refused: the clock must return a positive whole number of milliseconds.');
  }
  return now;
}

/** What R-3 read about the chain, the epoch and the lineage of the old database. `bigint` values are decimal text. */
export interface SourceFacts {
  /** `core_state.epoch`; null when the table has no row (a database that was never seeded). */
  readonly epoch: string | null;
  /** `audit_chain_head.seq` and `.hash`. */
  readonly headSeq: string;
  readonly headHash: string;
  /** `min(seq)` of `audit_log`; null when the log is empty. */
  readonly firstSeq: string | null;
  /** `count(*)` of `audit_log`. */
  readonly rowCount: string;
  /** `count(*)`, `max(reset_no)` and `max(epoch)` of `audit_chain_history`. */
  readonly lineageRows: number;
  readonly maxResetNo: string | null;
  readonly maxLineageEpoch: string | null;
}

/** One row of `audit_chain_history`, as it is bound to the INSERT of R-5e. */
export interface LineageRow {
  readonly resetNo: string;
  readonly epoch: string;
  readonly headHash: string;
  readonly rowCount: string;
  readonly firstSeq: string;
  readonly lastSeq: string;
  readonly resetAt: string;
  readonly actorId: string | null;
  readonly reason: ChainDiscardReason;
  readonly scenario: ScenarioValue;
}

export interface ScenarioLoadedFacts {
  /** `count(*)` of the discarded `audit_log`. */
  readonly previousRows: number;
  /** `audit_chain_head.hash` of the discarded database. */
  readonly previousHead: string;
}

export interface ResetPlan {
  /** True when the target does not exist: nothing is carried, no lineage row, no SCENARIO_LOADED row. */
  readonly firstBuild: boolean;
  /** The epoch the old database was in; null for a first build and for a database that was never seeded. */
  readonly previousEpoch: number | null;
  /** The epoch the seed writes into the new database. */
  readonly epoch: number;
  /** The row R-5e appends; null when nothing was discarded (LN-1). */
  readonly lineage: LineageRow | null;
  /** The details of the SCENARIO_LOADED row of R-5f; null for a first build. */
  readonly scenarioLoaded: ScenarioLoadedFacts | null;
}

function decimal(value: string | null, what: string): bigint | null {
  if (value === null) return null;
  if (!DECIMAL.test(value)) throw new ResetError('RESET_READ_FAILED', 'R-3', `the old database returned ${what} in a form the routine does not expect.`);
  return BigInt(value);
}

function safeNumber(value: bigint, what: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ResetError('RESET_READ_FAILED', 'R-3', `${what} of the old database is larger than the shared code can represent.`);
  }
  return Number(value);
}

/**
 * Decides the epoch, the lineage row and the details of the SCENARIO_LOADED row.
 *
 * `source` is null when the target does not exist (a first build). `now` is the reset's instant.
 *
 * THE EPOCH. The old database's `core_state.epoch`, plus 1. A database with no state row was
 * never seeded: its build starts at 0, like a first build. One case has no value to continue
 * from although something is discarded: a state row is missing while the audit log or the
 * lineage is not empty. That is a damaged database, which no program of this project produces;
 * a reset is the way out of it, so the routine does not refuse. It takes the epoch after the
 * newest one the lineage records (0 when there is none) as the epoch the discarded chain ended
 * in. The lineage's UNIQUE (epoch) then still holds.
 */
export function planReset(source: SourceFacts | null, request: ResetRequest, now: number): ResetPlan {
  if (source === null) {
    return { firstBuild: true, previousEpoch: null, epoch: 0, lineage: null, scenarioLoaded: null };
  }

  const stored = decimal(source.epoch, 'the epoch');
  const rowCount = decimal(source.rowCount, 'the row count of the audit log') ?? 0n;
  const headSeq = decimal(source.headSeq, 'the head sequence') ?? 0n;
  const maxLineageEpoch = decimal(source.maxLineageEpoch, 'the newest lineage epoch');
  const maxResetNo = decimal(source.maxResetNo, 'the newest lineage number');
  if (!HEX64.test(source.headHash)) {
    throw new ResetError('RESET_READ_FAILED', 'R-3', 'the old database returned a chain head that is not 64 hexadecimal digits.');
  }

  const discards = rowCount > 0n;
  let chainEpoch: bigint | null = stored;
  if (chainEpoch === null && (discards || source.lineageRows > 0)) {
    chainEpoch = maxLineageEpoch === null ? 0n : maxLineageEpoch + 1n;
  }
  const previousEpoch = chainEpoch === null ? null : safeNumber(chainEpoch, 'the epoch');
  const epoch = chainEpoch === null ? 0 : safeNumber(chainEpoch + 1n, 'the epoch');

  let lineage: LineageRow | null = null;
  if (discards) {
    const firstSeq = decimal(source.firstSeq, 'the first sequence of the audit log');
    if (firstSeq === null || chainEpoch === null) {
      throw new ResetError('RESET_READ_FAILED', 'R-3', 'the old database has audit rows but no first sequence.');
    }
    lineage = {
      resetNo: ((maxResetNo ?? 0n) + 1n).toString(),
      epoch: chainEpoch.toString(),
      headHash: source.headHash,
      rowCount: rowCount.toString(),
      firstSeq: firstSeq.toString(),
      lastSeq: headSeq.toString(),
      resetAt: String(now),
      actorId: request.actorId,
      reason: request.reason,
      scenario: request.scenario,
    };
  }

  return {
    firstBuild: false,
    previousEpoch,
    epoch,
    lineage,
    scenarioLoaded: { previousRows: safeNumber(rowCount, 'the row count of the audit log'), previousHead: source.headHash },
  };
}

/** The head of an empty chain: what `previousHead` holds when the old audit log had no row. */
export const EMPTY_CHAIN_HEAD = GENESIS_HASH;

/**
 * The SCENARIO_LOADED row and event of R-5f, as input for the shared `recordActivity`.
 *
 * Messages are the shared simulator's (`loadScenarioState`). Details: `scenario`, `reset`
 * (true for a reset, false for a scenario load), `previousRows`, `previousHead` (DC-7). The
 * actor is the resetting operator, or null from the command line (DC-9).
 */
export function scenarioLoadedActivity(request: ResetRequest, facts: ScenarioLoadedFacts): ActivityInput {
  const reset = request.reason === 'RESET';
  return {
    audit: {
      type: 'SCENARIO_LOADED',
      message: reset ? 'Demo reset (fresh dataset)' : `Demo scenario "${request.scenario}" loaded`,
      actorId: request.actorId,
      details: { scenario: request.scenario, reset, previousRows: facts.previousRows, previousHead: facts.previousHead },
    },
    event: {
      type: 'SCENARIO_LOADED',
      message: reset ? 'Demo reset' : `Demo scenario loaded · ${request.scenario}`,
      params: { scenario: request.scenario, reset },
    },
  };
}
