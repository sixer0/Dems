/**
 * The frame every part of the bulk fixture is built in (plan row W25; database contract BF-2,
 * BF-3, TI-16): the clock, the base it stands on, the counters it continues, the streams it
 * draws from, and the list of things that happened.
 *
 * THE CLOCK. `now` is injected; nothing here reads the system time. EVERY instant the fixture
 * writes is at or before `now`, so a server that starts on a bulk database with its clock at
 * `now` (or later) finds nothing dated in its future. The fixture's history covers the 62 WIB
 * days up to `now`: recordings on the days before the seeded dataset's own (which fills the
 * last three days), everything else up to `now`.
 *
 * THE BASE. The fixture is built on top of a seeded database (BF-2). `BulkBase` is what the
 * builder needs to know about it: the durable slices as the one mapping reads them back, the
 * seed instant, the Core's certificate fingerprint, the two registry counters and the row
 * counts. The loader reads it from the database inside its transaction; a pure test builds it
 * from the shared dataset.
 *
 * THE ACTIVITY LIST. A part of the fixture records what happened as audit and event inputs with
 * the instant it happened at (the shape of the shared dataset's own `SeedRow`). The builder
 * sorts the list by instant and appends it to the chain with the shared `appendAudit` and
 * `appendEvent`, one row after another, exactly as the shared dataset replays its history.
 */
import { startOfWibDay, type AuditInput, type EventInput, type OperatorRole } from '@dems/shared/sim';
import type { DurableSlices } from '../mapping';
import { BULK_FIXTURE_SEED, fixtureRng, type FixtureRng } from './rng';
import { BulkFixtureError } from './target';

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** How many WIB days before the day of `now` the fixture's history starts. */
export const FIXTURE_WORLD_DAYS = 62;
/** The seeded dataset fills the day of `now` and the two days before; fixture recordings end before them. */
export const SEEDED_DATASET_DAYS = 3;

/**
 * The stream the digests of `FRAME_HASH` rows are drawn from (`details.sha256`, 64 hexadecimal
 * digits, as the engine's generator draws them). One stream of its own, so that no other row's
 * numbers move.
 */
export const FRAME_HASH_STREAM = 'frame-hashes';

/** An auth session ends at the latest 8 hours after its issue (contract §4.6, ID-P5). */
export const SESSION_ABSOLUTE_MS = 8 * HOUR_MS;
/** A pairing code lives 300 seconds (contract §4.7, PR-P2). */
export const PAIRING_CODE_TTL_MS = 300 * SECOND_MS;
/** A biometric token lives 30 days (contract §4.10, ID-P11). */
export const BIOMETRIC_TOKEN_TTL_MS = 30 * DAY_MS;
/** The expiry sweep runs every 5 seconds (ID-P8): an expiry is noticed at most that much later. */
export const EXPIRY_SWEEP_MS = 5 * SECOND_MS;

/**
 * Text that exercises the storage path: Latin letters with diacritics, CJK, a combining accent,
 * and two characters outside the Basic Multilingual Plane (a Gothic letter and an emoji), which
 * JavaScript holds as surrogate pairs. Well-formed, and without U+0000 (the API's text rule).
 */
export const UNICODE_SAMPLE = 'ünïcødé 測試 é \u{10348} \u{1f6f0}';

/** What the builder needs to know about the seeded database it extends. */
export interface BulkBase {
  /** The 28 durable slices, as `fromRows(readStoredRows(...))` gives them. */
  readonly slices: DurableSlices;
  /** `core_state.seeded_at`. */
  readonly seededAt: number;
  /** `core_device.certificate_fingerprint`. No durable slice holds it; the row of a pairing names it. */
  readonly certificateFingerprint: string;
  /** `registry_counters.next_value` of the two counters. */
  readonly registryCounters: { readonly device: number; readonly pairingCode: number };
  /** The row count of each of the 40 tables before the load, by SQL name. */
  readonly counts: Readonly<Record<string, number>>;
}

export interface BulkFixtureOptions {
  /** The instant the fixture is built as of, in epoch milliseconds. Nothing it writes is later. */
  readonly now: number;
  /** Default: `BULK_FIXTURE_SEED`. */
  readonly seed?: number;
  /** The variant of the contract's table: one session in RECORDING with a full 200-item timeline. */
  readonly activeSession?: boolean;
}

/** Something that happened at `at`: an audit row, an operational event, or both. */
export interface Activity {
  readonly at: number;
  readonly audit?: AuditInput;
  readonly event?: EventInput;
}

/** A change of an operator's account, with the role it had before a role change. */
export interface OperatorChange {
  readonly at: number;
  readonly kind: 'DISABLED' | 'ENABLED' | 'ROLE';
  readonly previousRole?: OperatorRole;
}

/** The next free number of each counter the fixture continues. */
export interface FixtureCounters {
  session: number;
  caseNumber: number;
  evidence: number;
  item: number;
  export: number;
  device: number;
  pairingCode: number;
}

/** `value` as a decimal number of at least `width` digits. */
export function padded(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export class World {
  readonly now: number;
  readonly seed: number;
  readonly base: BulkBase;
  /** 00:00 WIB of the day that contains `now`. */
  readonly dayStart: number;
  /** 00:00 WIB of the first day of the fixture's history. */
  readonly worldStart: number;
  readonly counters: FixtureCounters;
  readonly #streams = new Map<string, FixtureRng>();
  readonly #activities: Array<Activity & { readonly order: number }> = [];
  readonly #exports: Array<{ readonly at: number; readonly order: number; readonly record: (exportId: string) => void }> = [];

  constructor(options: BulkFixtureOptions, base: BulkBase, firstExportNumber: number) {
    const seed = options.seed ?? BULK_FIXTURE_SEED;
    if (!Number.isSafeInteger(options.now) || options.now <= 0) {
      throw new BulkFixtureError('OPTION_INVALID', 'now must be a positive whole number of milliseconds.');
    }
    if (!Number.isSafeInteger(seed)) throw new BulkFixtureError('OPTION_INVALID', 'seed must be a safe integer.');
    this.now = options.now;
    this.seed = seed;
    this.base = base;
    this.dayStart = startOfWibDay(options.now);
    this.worldStart = this.dayStart - FIXTURE_WORLD_DAYS * DAY_MS;
    const counters = base.slices.meta.counters;
    this.counters = {
      session: counters.session,
      caseNumber: counters.caseNumber,
      evidence: counters.evidence,
      item: counters.item,
      export: counters.export ?? firstExportNumber,
      device: base.registryCounters.device,
      pairingCode: base.registryCounters.pairingCode,
    };
  }

  /** The stream `name`; every call with the same name returns the same generator. */
  rng(name: string): FixtureRng {
    let stream = this.#streams.get(name);
    if (stream === undefined) {
      stream = fixtureRng(this.seed, name);
      this.#streams.set(name, stream);
    }
    return stream;
  }

  /** The instant `hour:minute:second` WIB on the day `daysAgo` days before the day of `now`. */
  dayAt(daysAgo: number, hour: number, minute = 0, second = 0): number {
    return this.dayStart - daysAgo * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS + second * SECOND_MS;
  }

  /** Records something that happened. An instant after `now` is a defect of the fixture. */
  record(at: number, what: { readonly audit?: AuditInput; readonly event?: EventInput }): void {
    if (!Number.isSafeInteger(at) || at > this.now) {
      throw new BulkFixtureError('BUILD_INVALID', 'an activity of the fixture is dated after its clock.');
    }
    this.#activities.push({ at, ...what, order: this.#activities.length });
  }

  /**
   * An accepted export at `at`. Export identifiers are minted in the order of the exports, which
   * is known only when every part has recorded its own: `record` is called by `mintExports`.
   */
  deferExport(at: number, record: (exportId: string) => void): void {
    this.#exports.push({ at, order: this.#exports.length, record });
  }

  /** Mints `EXP-NNNNNN` for every deferred export, oldest first, and records each. */
  mintExports(exportIdFor: (number: number) => string): void {
    const pending = this.#exports.splice(0).sort((a, b) => a.at - b.at || a.order - b.order);
    for (const entry of pending) {
      const id = exportIdFor(this.counters.export);
      this.counters.export += 1;
      entry.record(id);
    }
  }

  /** How many activities with an audit row were recorded so far. */
  get auditActivities(): number {
    return this.#activities.reduce((count, activity) => count + (activity.audit === undefined ? 0 : 1), 0);
  }

  /** How many activities with an event were recorded so far. */
  get eventActivities(): number {
    return this.#activities.reduce((count, activity) => count + (activity.event === undefined ? 0 : 1), 0);
  }

  /** The activities in the order they are appended: by instant, then in the order recorded. */
  activities(): Activity[] {
    return [...this.#activities].sort((a, b) => a.at - b.at || a.order - b.order);
  }

  /** `PREFIX-NNNNNN` from the item counter, as the shared `nextItemId` mints it. */
  nextItem(prefix: string): string {
    const id = `${prefix}-${padded(this.counters.item, 6)}`;
    this.counters.item += 1;
    return id;
  }
}
