/**
 * Names of test databases and the name guard (database contract §10: TI-2, TI-3, TI-12).
 * Everything here is pure: no connection, no file, no clock of its own.
 *
 *   run prefix   dems_test_<label>_<stamp>_
 *                <label>  `step_<row>` when DEMS_TEST_STEP is set, `local` otherwise
 *                <stamp>  eight base-36 characters: the start time in seconds (six characters)
 *                         followed by two random characters
 *   templates    <prefix>tpl_schema, <prefix>tpl_seed, <prefix>tpl_bulk
 *                (a helper-private or row-private template is <prefix>tpl_x_<name>)
 *   test file    <prefix>f<nn>_<slug>, at most 63 bytes
 *
 * THE GUARD. A statement that creates, changes or drops a database takes a
 * `GuardedDatabaseName`, and only the functions at the end of this file produce one:
 * `guardOwnDatabase` (a name of the caller's own run), `guardStaleDatabase` (a name of a run
 * that is older than the threshold and holds no liveness lock) and `guardDeadRunDatabase` (a
 * name of one run that was named and shown to be dead). Each throws a `DbGuardError` before
 * any statement exists. None can return `dems_demo`, a lane database, `postgres`,
 * `template0`, `template1`, a proof database or a database of a run that is alive.
 */
import { randomInt } from 'node:crypto';
import {
  ENV_TEST_STEP,
  LIVENESS_KEY_SPACE,
  LOCAL_LABEL,
  MAX_IDENTIFIER_BYTES,
  MAX_LIVE_CLONES,
  STALE_AFTER_SECONDS,
  TEST_DATABASE_PREFIX,
} from './constants';
import { DbGuardError, DbTestHelperError } from './errors';

const STAMP_TIME_CHARACTERS = 6;
const STAMP_RANDOM_CHARACTERS = 2;
const STAMP_PATTERN = /^[0-9a-z]{8}$/;
const LABEL_PATTERN = /^(?:local|step_[a-z0-9]{1,12})$/;
const STEP_PATTERN = /^[A-Za-z0-9]{1,12}$/;
/** TI-3: what a test database name looks like at all. */
const TEST_NAME_PATTERN = /^dems_test_[a-z0-9_]+$/;
/** A name of the scheme of TI-2, split into its run prefix and the rest. */
const RUN_NAME_PATTERN = /^(dems_test_(local|step_[a-z0-9]{1,12})_([0-9a-z]{8})_)([a-z0-9_]+)$/;
/** A run prefix of that scheme: the whole text, and nothing after the last underscore. */
const RUN_PREFIX_PATTERN = /^dems_test_(local|step_[a-z0-9]{1,12})_([0-9a-z]{8})_$/;
const TEMPLATE_KEY_PATTERN = /^(?:schema|seed|bulk|x_[a-z0-9]{1,16})$/;
const CLONE_REST_PATTERN = /^f([0-9]{2})_[a-z0-9_]+$/;

/** One run of `test:db`: every database it creates starts with `prefix`. */
export interface RunIdentity {
  readonly label: string;
  readonly stamp: string;
  readonly prefix: string;
}

/** `step_<row>` when the row label is set, `local` otherwise. A malformed label stops the run. */
export function runLabel(step: string | undefined): string {
  if (step === undefined || step === '') return LOCAL_LABEL;
  if (!STEP_PATTERN.test(step)) {
    throw new DbTestHelperError(
      'RUN_LABEL_INVALID',
      `${ENV_TEST_STEP} must be 1 to 12 letters or digits (the row, for example 33 or W17).`,
    );
  }
  return `step_${step.toLowerCase()}`;
}

/** The start time in seconds as six base-36 characters, then two random characters. */
export function newStamp(nowMs: number, randomDigit: () => number = () => randomInt(36)): string {
  const seconds = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds >= 36 ** STAMP_TIME_CHARACTERS) {
    throw new DbTestHelperError('NAME_INVALID', 'The start time does not fit the six characters of a run stamp.');
  }
  let stamp = seconds.toString(36).padStart(STAMP_TIME_CHARACTERS, '0');
  for (let i = 0; i < STAMP_RANDOM_CHARACTERS; i += 1) {
    const digit = Math.trunc(randomDigit());
    stamp += Math.min(35, Math.max(0, digit)).toString(36);
  }
  return stamp;
}

/** The start time that a stamp carries, in seconds since the epoch. */
export function stampSeconds(stamp: string): number {
  return Number.parseInt(stamp.slice(0, STAMP_TIME_CHARACTERS), 36);
}

/** Builds the identity of a run from its two parts; both are checked. */
export function createRunIdentity(label: string, stamp: string): RunIdentity {
  if (!LABEL_PATTERN.test(label)) {
    throw new DbTestHelperError('NAME_INVALID', `The run label ${JSON.stringify(label)} is not "local" or "step_<row>".`);
  }
  if (!STAMP_PATTERN.test(stamp)) {
    throw new DbTestHelperError('NAME_INVALID', `The run stamp ${JSON.stringify(stamp)} is not eight base-36 characters.`);
  }
  return Object.freeze({ label, stamp, prefix: `${TEST_DATABASE_PREFIX}${label}_${stamp}_` });
}

export interface ParsedTestDatabaseName {
  readonly run: RunIdentity;
  /** What follows the run prefix: `tpl_schema`, `f01_identity`, ... */
  readonly rest: string;
  readonly startedAtSeconds: number;
}

/** Splits a name of the scheme of TI-2. `null` for every other name. */
export function parseTestDatabaseName(name: string): ParsedTestDatabaseName | null {
  if (Buffer.byteLength(name, 'utf8') > MAX_IDENTIFIER_BYTES) return null;
  const match = RUN_NAME_PATTERN.exec(name);
  const label = match?.[2];
  const stamp = match?.[3];
  const rest = match?.[4];
  if (label === undefined || stamp === undefined || rest === undefined) return null;
  return { run: createRunIdentity(label, stamp), rest, startedAtSeconds: stampSeconds(stamp) };
}

/**
 * The run that a prefix names: exactly `dems_test_<label>_<stamp>_`. `null` for every other
 * value: a database name, a prefix without its last underscore, a pattern, the demo database.
 */
export function parseRunPrefix(prefix: unknown): RunIdentity | null {
  if (typeof prefix !== 'string') return null;
  const match = RUN_PREFIX_PATTERN.exec(prefix);
  const label = match?.[1];
  const stamp = match?.[2];
  if (label === undefined || stamp === undefined) return null;
  return createRunIdentity(label, stamp);
}

/** `schema`, `seed`, `bulk`, or `x_<name>` for a private template. */
export function isTemplateKey(key: string): boolean {
  return TEMPLATE_KEY_PATTERN.test(key);
}

/** `<prefix>tpl_<key>`. */
export function templateDatabaseName(run: RunIdentity, key: string): string {
  if (!isTemplateKey(key)) {
    throw new DbTestHelperError(
      'NAME_INVALID',
      `The template ${JSON.stringify(key)} is not schema, seed, bulk or x_<name> (1 to 16 letters or digits).`,
    );
  }
  return `${run.prefix}tpl_${key}`;
}

/** The base name of a test file reduced to `[a-z0-9_]`: `identity-login.db.test.ts` gives `identity_login`. */
export function slugFromFile(file: string): string {
  const base = file.split(/[\\/]/).pop() ?? '';
  const stem = base.replace(/\.(?:db\.)?(?:test|spec)\.[cm]?[jt]sx?$/, '').replace(/\.[cm]?[jt]sx?$/, '');
  return sanitizeSlug(stem);
}

function sanitizeSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug === '' ? 'file' : slug;
}

/** `<prefix>f<nn>_<slug>`, with the slug cut so that the whole name is at most 63 bytes. */
export function fileDatabaseName(run: RunIdentity, counter: number, slug: string): string {
  if (!Number.isInteger(counter) || counter < 1 || counter > MAX_LIVE_CLONES) {
    throw new DbTestHelperError('NAME_INVALID', `The clone counter must be 1 to ${MAX_LIVE_CLONES}.`);
  }
  const head = `${run.prefix}f${String(counter).padStart(2, '0')}_`;
  const room = MAX_IDENTIFIER_BYTES - head.length;
  const cut = sanitizeSlug(slug).slice(0, room).replace(/_+$/g, '');
  return `${head}${cut === '' ? 'x' : cut}`;
}

/** The counter of a per-file database of this run, or `null` for any other name. */
export function cloneCounterOf(name: string, run: RunIdentity): number | null {
  if (!name.startsWith(run.prefix)) return null;
  const digits = CLONE_REST_PATTERN.exec(name.slice(run.prefix.length))?.[1];
  return digits === undefined ? null : Number(digits);
}

/** The lowest counter that no existing database of the run uses. */
export function lowestFreeCounter(existingNames: readonly string[], run: RunIdentity): number {
  const used = new Set<number>();
  for (const name of existingNames) {
    const counter = cloneCounterOf(name, run);
    if (counter !== null) used.add(counter);
  }
  for (let counter = 1; counter <= MAX_LIVE_CLONES; counter += 1) {
    if (!used.has(counter)) return counter;
  }
  throw new DbTestHelperError(
    'CLONE_SLOTS_EXHAUSTED',
    `${MAX_LIVE_CLONES} databases of the run ${run.prefix}* exist at the same time; drop one before cloning again.`,
  );
}

/** True for a template of a run (`<prefix>tpl_...`). */
export function isTemplateName(name: string): boolean {
  return parseTestDatabaseName(name)?.rest.startsWith('tpl_') === true;
}

/**
 * The second key of the "this run is alive" advisory lock: 1 to 1073741823, derived from the
 * stamp (FNV-1a). Never 0, which is the clone lock.
 */
export function livenessKey(stamp: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < stamp.length; i += 1) {
    hash ^= stamp.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % LIVENESS_KEY_SPACE) + 1;
}

// ── Stale sweep: classification (TI-12) ────────────────────────────────────────────────────────

export interface StaleRun {
  readonly run: RunIdentity;
  readonly ageSeconds: number;
  readonly databases: readonly string[];
}

export interface SweepPlan {
  /** Databases of the caller's own run: never swept. */
  readonly own: readonly string[];
  /** Databases of another run that is not older than the threshold: never swept. */
  readonly younger: readonly string[];
  /** Names that start with `dems_test_` but are not of the scheme: left alone. */
  readonly unrecognised: readonly string[];
  /** Runs older than the threshold. Each still needs the liveness check before a drop. */
  readonly stale: readonly StaleRun[];
}

/** Sorts database names for the sweep. Names without the test prefix are not even listed. */
export function classifyForSweep(names: readonly string[], own: RunIdentity, nowSeconds: number): SweepPlan {
  const ownNames: string[] = [];
  const younger: string[] = [];
  const unrecognised: string[] = [];
  const stale = new Map<string, { run: RunIdentity; ageSeconds: number; databases: string[] }>();
  for (const name of [...names].sort()) {
    if (!name.startsWith(TEST_DATABASE_PREFIX)) continue;
    if (name.startsWith(own.prefix)) {
      ownNames.push(name);
      continue;
    }
    const parsed = parseTestDatabaseName(name);
    if (parsed === null) {
      unrecognised.push(name);
      continue;
    }
    const ageSeconds = nowSeconds - parsed.startedAtSeconds;
    if (!(ageSeconds > STALE_AFTER_SECONDS)) {
      younger.push(name);
      continue;
    }
    const entry = stale.get(parsed.run.prefix) ?? { run: parsed.run, ageSeconds, databases: [] };
    entry.databases.push(name);
    stale.set(parsed.run.prefix, entry);
  }
  return { own: ownNames, younger, unrecognised, stale: [...stale.values()] };
}

// ── The guard (TI-3) ───────────────────────────────────────────────────────────────────────────

declare const guardedBrand: unique symbol;
/** A database name that passed the guard. Statements that change a database accept nothing else. */
export type GuardedDatabaseName = string & { readonly [guardedBrand]: true };

/** What the helper may do to a database of its own run. Used in refusal messages. */
export type GuardedAction = 'create' | 'clone' | 'lock' | 'unlock' | 'drop' | 'connect to';

/** Why a name is protected outright, or `null`. These names can never pass either guard. */
export function protectedReason(name: string): string | null {
  if (name === 'postgres') return 'the maintenance database';
  if (name === 'template0' || name === 'template1') return 'a template database of PostgreSQL';
  if (name.startsWith('dems_demo')) return 'the database of the main instance, or a copy the reset routine keeps';
  if (name.startsWith('dems_lane_')) return 'a lane database, or a copy the reset routine keeps';
  if (name.startsWith('dems_proof_')) return "a proof row's scratch database";
  if (name.startsWith('dems_trial_')) return 'a database of the provisioning trial';
  return null;
}

function refuseUnlessTestName(name: unknown, action: GuardedAction): asserts name is string {
  const shown = typeof name === 'string' ? JSON.stringify(name) : `a value of type ${typeof name}`;
  if (typeof name !== 'string' || name === '') {
    throw new DbGuardError('GUARD_NOT_A_TEST_DATABASE', String(name), `refused before any statement: cannot ${action} ${shown}.`);
  }
  const reason = protectedReason(name);
  if (reason !== null) {
    throw new DbGuardError(
      'GUARD_PROTECTED_DATABASE',
      name,
      `refused before any statement: ${shown} is ${reason}. The test helper may ${action} only a database of its own run.`,
    );
  }
  if (!TEST_NAME_PATTERN.test(name) || Buffer.byteLength(name, 'utf8') > MAX_IDENTIFIER_BYTES) {
    throw new DbGuardError(
      'GUARD_NOT_A_TEST_DATABASE',
      name,
      `refused before any statement: ${shown} is not a test database (${TEST_DATABASE_PREFIX}[a-z0-9_]+, at most ${MAX_IDENTIFIER_BYTES} bytes).`,
    );
  }
}

/**
 * Passes a name only when it belongs to `run`. Everything else is refused, and a database of
 * another run is refused whatever its age: a parallel row may be using it (TI-12).
 */
export function guardOwnDatabase(name: unknown, run: RunIdentity, action: GuardedAction): GuardedDatabaseName {
  refuseUnlessTestName(name, action);
  if (!name.startsWith(run.prefix) || name.length === run.prefix.length) {
    const other = parseTestDatabaseName(name);
    const whose = other === null ? 'not of this run' : `of another run (${other.run.prefix}*); a parallel row may be using it`;
    throw new DbGuardError(
      'GUARD_FOREIGN_RUN',
      name,
      `refused before any statement: ${JSON.stringify(name)} is ${whose}. This run may ${action} only ${run.prefix}*.`,
    );
  }
  return name as GuardedDatabaseName;
}

/** Proof that the sweep holds the liveness lock of a stale run: no live run has that stamp. */
export interface StaleClaim {
  readonly stamp: string;
  /** The time of the decision, in seconds since the epoch. */
  readonly nowSeconds: number;
}

/**
 * Passes a name of another run only when that run is older than the threshold and the caller
 * holds its liveness lock (`claim`). A younger database is refused.
 */
export function guardStaleDatabase(name: unknown, own: RunIdentity, claim: StaleClaim): GuardedDatabaseName {
  refuseUnlessTestName(name, 'drop');
  const parsed = parseTestDatabaseName(name);
  if (parsed === null) {
    throw new DbGuardError(
      'GUARD_NOT_A_TEST_DATABASE',
      name,
      `refused before any statement: ${JSON.stringify(name)} is not of the naming scheme, so its age is unknown.`,
    );
  }
  if (parsed.run.prefix === own.prefix) {
    throw new DbGuardError('GUARD_NOT_STALE', name, `refused before any statement: ${JSON.stringify(name)} belongs to this run; the sweep is for other runs.`);
  }
  const ageSeconds = claim.nowSeconds - parsed.startedAtSeconds;
  if (!(ageSeconds > STALE_AFTER_SECONDS)) {
    throw new DbGuardError(
      'GUARD_NOT_STALE',
      name,
      `refused before any statement: ${JSON.stringify(name)} belongs to another run that started ${Math.max(0, Math.round(ageSeconds))} s ago, ` +
        `which is not more than ${STALE_AFTER_SECONDS} s; a parallel row may be using it.`,
    );
  }
  if (claim.stamp !== parsed.run.stamp) {
    throw new DbGuardError(
      'GUARD_NOT_STALE',
      name,
      `refused before any statement: the liveness lock of the run ${parsed.run.prefix}* is not held by the sweep.`,
    );
  }
  return name as GuardedDatabaseName;
}

/**
 * Proof that one run was named for removal and shown to be dead: the caller holds that run's
 * liveness lock, so no live session is its owner, and saw no client session on its databases
 * (`TestRun.dropDeadRun`).
 */
export interface DeadRunClaim {
  /** The run that was named. */
  readonly run: RunIdentity;
}

/**
 * Passes a name only when it belongs to the run of `claim`, and that run is not the caller's
 * own. The age of the run plays no part: that it is dead was shown another way.
 */
export function guardDeadRunDatabase(name: unknown, own: RunIdentity, claim: DeadRunClaim): GuardedDatabaseName {
  refuseUnlessTestName(name, 'drop');
  if (claim.run.prefix === own.prefix) {
    throw new DbGuardError(
      'GUARD_NOT_STALE',
      name,
      `refused before any statement: ${JSON.stringify(name)} belongs to this run; a run removes its own databases with its teardown.`,
    );
  }
  if (!name.startsWith(claim.run.prefix) || name.length === claim.run.prefix.length) {
    throw new DbGuardError(
      'GUARD_FOREIGN_RUN',
      name,
      `refused before any statement: ${JSON.stringify(name)} is not a database of the run ${claim.run.prefix}* that was named.`,
    );
  }
  // The same test as for a database of the caller's own run, against the run that was named.
  return guardOwnDatabase(name, claim.run, 'drop');
}

/** A double-quoted identifier. The guard has already limited the name to `[a-z0-9_]`. */
export function quoteDatabaseName(name: GuardedDatabaseName): string {
  return `"${name}"`;
}
