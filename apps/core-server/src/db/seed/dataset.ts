/**
 * The dataset of a seed: the shared simulator's initial state as of one instant (plan row W20;
 * database contract SD-1, SD-2, DR-1, DR-2; spec ENG-17, ENG-20).
 *
 * The seed copies no dataset value into its own source: every operator, session, evidence item,
 * audit row and event comes out of the shared builders, for the `now` the caller read ONCE from
 * the server clock. This module computes no date itself. Session, evidence and case identifiers
 * therefore carry the WIB date of the seed, and the audit hashes differ from one seed date to
 * the next; the demo evidence packages stay frozen and join on any day (`matchDemoPackage`).
 *
 * Pure: the same options give the same state.
 */
import { DEFAULT_SEED, ScenarioName, buildScenarioState, createIdleState, isScenarioName, type SimState } from '@dems/shared/sim';

export interface DatasetOptions {
  /** The instant the dataset is built as of, in epoch milliseconds on the server clock. */
  readonly now: number;
  /** Default: the shared `DEFAULT_SEED`. */
  readonly seed?: number;
  /** Default: `idle`. */
  readonly scenario?: ScenarioName;
  /** Default 0. A reset passes the previous epoch plus 1 (the epoch continues). */
  readonly epoch?: number;
}

export interface ResolvedDatasetOptions {
  readonly now: number;
  readonly seed: number;
  readonly scenario: ScenarioName;
  readonly epoch: number;
}

/** A dataset option the shared builders cannot work with. The message names the option, never a credential. */
export class DatasetOptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetOptionError';
  }
}

export function resolveDatasetOptions(options: DatasetOptions): ResolvedDatasetOptions {
  const { now } = options;
  const seed = options.seed ?? DEFAULT_SEED;
  const scenario = options.scenario ?? ScenarioName.IDLE;
  const epoch = options.epoch ?? 0;
  if (!Number.isSafeInteger(now) || now <= 0) throw new DatasetOptionError('now must be a positive whole number of milliseconds.');
  if (!Number.isSafeInteger(seed)) throw new DatasetOptionError('seed must be a safe integer.');
  if (!isScenarioName(scenario)) throw new DatasetOptionError('scenario must be one of idle, recording, finalizing, fault-demo.');
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new DatasetOptionError('epoch must be a whole number, zero or more.');
  return { now, seed, scenario, epoch };
}

/**
 * The state to seed: `createIdleState` for `idle`, `buildScenarioState` on that baseline for the
 * three other scenarios (SD-2), with the epoch the caller chose.
 */
export function buildSeedState(options: DatasetOptions): SimState {
  const { now, seed, scenario, epoch } = resolveDatasetOptions(options);
  const baseline = createIdleState({ now, seed });
  const state = buildScenarioState(scenario, baseline);
  return state.meta.epoch === epoch ? state : { ...state, meta: { ...state.meta, epoch } };
}
