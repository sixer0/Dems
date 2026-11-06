// The seed clock rule and the frozen demo evidence packages (plan row W20; database contract
// §9.2 DR-1 to DR-7, §9.6 ST-5 and the checksum recipe; spec ENG-17, ENG-18).
//
// The file's own database is a migrated, empty clone (`tpl_schema`), seeded here ONE DAY after
// the fixed instant. It is compared with a clone of `tpl_seed` (the fixed instant) and with a
// second database seeded at the same later instant.
import { DEFAULT_SEED, DEMO_PACKAGE_INTEGRITY, ROLE_PERMISSIONS, createIdleState } from '@dems/shared/sim';
import { matchDemoPackage } from '@dems/shared/demo-data';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { fromRows, pickDurable, verifyStoredAuditRows, type StoredRows } from '../../mapping';
import { seedDatabase, type SeedReport } from '../seed';
import { countAllTables, readStoredRows } from '../../store';
import { DAY_MS, EXPECTED_SEED_COUNTS, FIXED_NOW, tableChecksums, withoutNegativeZeros } from '../../../../test/support/seed';

const db = useTestDatabase({ template: 'schema' });

// REVISED 2026-10-29 (0034_capture_config_supervisor_revocation, principal PT GSP): SUPERVISOR's
// CAPTURE_CONFIG grant is revoked — the seed writes the 22 grants of the shared `ROLE_PERMISSIONS`
// (recomputed FROM SOURCE, R3; the same composition as `seed.db.test.ts`).
const SEED_COUNTS: Readonly<Record<string, number>> = Object.freeze({
  ...EXPECTED_SEED_COUNTS,
  role_permissions: Object.values(ROLE_PERMISSIONS).reduce((sum, grants) => sum + grants.length, 0),
});

const LATER = FIXED_NOW + DAY_MS;

let dayOnePool: Pool;
let dayTwoPool: Pool;
let dayOne: StoredRows;
let dayTwo: StoredRows;
let report: SeedReport;

beforeAll(async () => {
  dayTwoPool = db.ownerPool();
  report = await seedDatabase(dayTwoPool, { now: LATER, target: 'test' });
  const first = await db.another({ template: 'seed', slug: 'w20_clock_day1' });
  dayOnePool = first.ownerPool();
  dayOne = await readStoredRows(drizzle(dayOnePool), { rings: 'all' });
  dayTwo = await readStoredRows(drizzle(dayTwoPool), { rings: 'all' });
});

// ── What the date rule predicts for a seed exactly one day later ───────────────────────────────

/** The WIB calendar day after `yyyymmdd`. */
function nextDay(yyyymmdd: string): string {
  const next = new Date(Date.UTC(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8)) + 1));
  return `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, '0')}${String(next.getUTCDate()).padStart(2, '0')}`;
}

/** Moves every dated identifier inside a text one day on: `SES-…`, `EV-…` and `LP/YYYY/MMDD-…`. */
function shiftIdentifiers(text: string): string {
  return text
    .replace(/\b(SES|EV)-(\d{8})-/g, (_match, prefix: string, date: string) => `${prefix}-${nextDay(date)}-`)
    .replace(/\bLP\/(\d{4})\/(\d{4})-/g, (_match, year: string, monthDay: string) => {
      const next = nextDay(`${year}${monthDay}`);
      return `LP/${next.slice(0, 4)}/${next.slice(4)}-`;
    });
}

/** A row one day later: `timeColumns` plus one day, dated identifiers in every text moved on. */
function shiftRow<R extends Record<string, unknown>>(row: R, timeColumns: readonly string[], omit: readonly string[] = []): Record<string, unknown> {
  const shifted: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    if (omit.includes(column)) continue;
    if (timeColumns.includes(column)) shifted[column] = typeof value === 'number' ? value + DAY_MS : value;
    else if (typeof value === 'string') shifted[column] = shiftIdentifiers(value);
    else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      shifted[column] = Object.fromEntries(Object.entries(value).map(([key, member]) => [key, typeof member === 'string' ? shiftIdentifiers(member) : member]));
    } else shifted[column] = value;
  }
  return shifted;
}

const without = <R extends Record<string, unknown>>(rows: readonly R[], omit: readonly string[]): Record<string, unknown>[] =>
  rows.map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => !omit.includes(column))));

describe('ST-5: a seed with now one day later', () => {
  it('has the same row counts, and the seed reports the later instant', async () => {
    expect(await countAllTables(drizzle(dayTwoPool))).toEqual(SEED_COUNTS);
    expect(report.counts).toEqual(SEED_COUNTS);
    expect(report).toMatchObject({ now: LATER, scenario: 'idle', seed: DEFAULT_SEED, epoch: 0, role: 'dems_owner', database: db.name });
    expect(report.auditHead.seq).toBe(82);
    console.log(
      `[w20] seed at one day later: prepare ${report.prepareMs.toFixed(1)} ms (dataset, mapping, 3 Argon2id derivations), transaction ${report.writeMs.toFixed(1)} ms, total ${report.totalMs.toFixed(1)} ms`,
    );
  });

  it('identifiers carry the later date (DR-2)', () => {
    const dates = (rows: StoredRows): string[] => [...new Set(rows.evidenceItems.map((item) => item.id.slice(3, 11)))].sort();
    expect(dates(dayOne)).toEqual(['20260929', '20260930', '20261001']);
    expect(dates(dayTwo)).toEqual(['20260930', '20261001', '20261002']);
    expect(dayTwo.sessionHistory.map((entry) => entry.id.slice(4, 12)).sort().at(-1)).toBe('20261002');
    expect(new Set(dayTwo.evidenceItems.map((item) => item.caseNumber.slice(0, 13)))).toEqual(new Set(['LP/2026/0930-', 'LP/2026/1001-']));
    expect(dayTwo.coreState[0]).toMatchObject({ seededAt: LATER, createdAt: LATER, lastResetAt: null });
  });

  it('matchDemoPackage joins all 13 items on both days, from the four stored columns (DR-3)', () => {
    for (const rows of [dayOne, dayTwo]) {
      const joined = rows.evidenceItems.map((item) =>
        matchDemoPackage({ id: item.id, sessionId: item.sessionId, caseNumber: item.caseNumber, subjectName: item.subjectName }),
      );
      expect(joined.filter((pkg) => pkg !== null)).toHaveLength(13);
      expect(joined.map((pkg) => pkg?.evidenceSuffix)).toEqual(rows.evidenceItems.map((item) => item.id.slice(-4)));
    }
  });

  it('integrity_source is DEMO_PACKAGE 13 times, and the stored hashes ARE the frozen package values on both days (DR-4)', () => {
    for (const rows of [dayOne, dayTwo]) {
      expect(rows.evidenceItems.filter((item) => item.integritySource === 'DEMO_PACKAGE')).toHaveLength(13);
      for (const item of rows.evidenceItems) {
        const frozen = DEMO_PACKAGE_INTEGRITY[item.id.slice(-4)];
        expect(frozen, item.id).toBeDefined();
        const tracks = rows.evidenceTracks.filter((track) => track.evidenceId === item.id).sort((a, b) => a.position - b.position);
        // Fix wave J (truth rule 3a): the item of the INCOMPLETE session was never sealed - it stores NO value of its package, on both days.
        if (item.sealedAt === null) {
          expect([item.id.slice(-4), item.status, item.manifestHash, tracks]).toEqual(['0006', 'RECORDED', '0'.repeat(64), []]);
          continue;
        }
        expect(item.manifestHash).toBe(frozen?.manifestSha256);
        expect(tracks.map((track) => track.sha256)).toEqual(frozen?.tracks);
      }
    }
    // No package path, media path or suffix is stored: the join is computed when it is read.
    expect(Object.keys(dayTwo.evidenceItems[0] ?? {}).filter((column) => /package|media|path/i.test(column))).toEqual([]);
  });

  it('the join is not vacuous: another case sequence or subject joins nothing', () => {
    const item = dayTwo.evidenceItems[0];
    if (item === undefined) throw new Error('no evidence');
    const base = { id: item.id, sessionId: item.sessionId, caseNumber: item.caseNumber, subjectName: item.subjectName };
    expect(matchDemoPackage(base)).not.toBeNull();
    expect(matchDemoPackage({ ...base, subjectName: 'Orang Lain' })).toBeNull();
    expect(matchDemoPackage({ ...base, caseNumber: 'LP/2026/1001-0099' })).toBeNull();
    expect(matchDemoPackage({ ...base, id: 'EV-20261002-0099' })).toBeNull();
  });

  it('the database seeded one day later is the dataset of that day: every durable slice equals createIdleState(later)', async () => {
    const reference = createIdleState({ now: LATER, seed: DEFAULT_SEED });
    // The series of that day holds one negative zero, which JSON stores as zero.
    expect(fromRows(await readStoredRows(drizzle(dayTwoPool)))).toStrictEqual(withoutNegativeZeros(reference));
    expect(fromRows(dayOne)).toStrictEqual(pickDurable(createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED })));
  });
});

describe('the two seeds differ only where the date rule says', () => {
  it('not at all: roles, permissions, grants, counters, storage policy, settings (apart from the row time)', async () => {
    const same = ['roles', 'permissions', 'role_permissions', 'registry_counters', 'engine_counters', 'schema_meta', 'audit_chain_history'];
    const one = await tableChecksums(dayOnePool);
    const two = await tableChecksums(dayTwoPool);
    for (const table of same) expect(`${table} ${two[table]}`).toBe(`${table} ${one[table]}`);
    expect(without(dayTwo.storagePolicy, ['updatedAt'])).toEqual(without(dayOne.storagePolicy, ['updatedAt']));
    expect(without(dayTwo.consoleSettings, ['updatedAt'])).toEqual(without(dayOne.consoleSettings, ['updatedAt']));
    expect(without(dayTwo.coreDevice, ['updatedAt'])).toEqual(without(dayOne.coreDevice, ['updatedAt']));
    expect(without(dayTwo.operators, ['createdAt', 'updatedAt'])).toEqual(without(dayOne.operators, ['createdAt', 'updatedAt']));
  });

  it('by exactly one day and one calendar date: sessions, evidence, tracks, custody and the export record', async () => {
    const exportsOf = async (pool: Pool): Promise<Record<string, unknown>[]> =>
      (await pool.query('SELECT id, scope, evidence_id, operator_id, reason, destination, at::float8 AS at FROM exports ORDER BY id')).rows;
    const exportedOne = await exportsOf(dayOnePool);
    expect(exportedOne).toHaveLength(1);
    expect(await exportsOf(dayTwoPool)).toEqual(exportedOne.map((row) => shiftRow(row, ['at'])));
    const history = ['createdAt', 'startedAt', 'endedAt'];
    expect(dayTwo.sessionHistory).toEqual(dayOne.sessionHistory.map((row) => shiftRow(row, history)));
    const evidence = ['recordedAt', 'endedAt', 'sealedAt', 'createdAt', 'updatedAt'];
    expect(dayTwo.evidenceItems).toEqual(dayOne.evidenceItems.map((row) => shiftRow(row, evidence)));
    expect(dayTwo.evidenceTracks).toEqual(dayOne.evidenceTracks.map((row) => shiftRow(row, [])));
    expect(dayTwo.evidenceCustody).toEqual(dayOne.evidenceCustody.map((row) => shiftRow(row, ['at'])));
    // Durations, sizes, statuses, the sealed hashes and the signature do not move.
    for (const [index, item] of dayTwo.evidenceItems.entries()) {
      const before = dayOne.evidenceItems[index];
      expect([item.durationMs, item.sizeBytes, item.status, item.manifestHash, item.signatureValue, item.subjectName]).toEqual([
        before?.durationMs,
        before?.sizeBytes,
        before?.status,
        before?.manifestHash,
        before?.signatureValue,
        before?.subjectName,
      ]);
    }
  });

  it('the audit rows and events: the same types, actors and texts with the dated identifiers moved; every time one day on', () => {
    // Everything but the two hash columns: the row of day one, moved by the date rule, is the row of day two.
    expect(without(dayTwo.auditLog, ['prevHash', 'hash'])).toEqual(dayOne.auditLog.map((row) => shiftRow(row, ['at'], ['prevHash', 'hash'])));
    expect(dayTwo.auditLog.map((row) => row.at)).toEqual(dayOne.auditLog.map((row) => row.at + DAY_MS));
    expect(dayTwo.events).toEqual(dayOne.events.map((row) => shiftRow(row, ['at'])));
    expect(dayTwo.auditLog.map((row) => row.type)).toEqual(dayOne.auditLog.map((row) => row.type));
  });

  it('the audit hashes differ from one seed date to the next, and each chain verifies (DR-2)', () => {
    const hashesOne = new Set(dayOne.auditLog.map((row) => row.hash));
    expect(dayTwo.auditLog.filter((row) => hashesOne.has(row.hash))).toEqual([]);
    expect(dayTwo.auditChainHead[0]?.hash).not.toBe(dayOne.auditChainHead[0]?.hash);
    expect(dayTwo.auditChainHead[0]?.seq).toBe(82);
    for (const rows of [dayOne, dayTwo]) {
      expect(verifyStoredAuditRows(rows.auditLog, { dropped: 0, head: rows.auditChainHead[0]?.hash ?? '' })).toEqual({ ok: true });
    }
  });

  it('the hardware snapshot: the same shape; its stored times one day on; the 24-hour usage curve the same', () => {
    const one = dayOne.hardwareSnapshot[0];
    const two = dayTwo.hardwareSnapshot[0];
    if (one === undefined || two === undefined) throw new Error('no snapshot row');
    expect(two.writtenAt).toBe(one.writtenAt + DAY_MS);
    expect(two.tabletLink).toEqual({ ...one.tabletLink, changedAt: one.tabletLink.changedAt + DAY_MS });
    expect(two.storage.history).toEqual(one.storage.history.map((point) => ({ ...point, at: point.at + DAY_MS })));
    expect(two.services).toEqual(one.services.map((service) => ({ ...service, startedAt: (service.startedAt ?? 0) + DAY_MS })));
    expect(two.timeStatus.history.map((point) => point.at)).toEqual(one.timeStatus.history.map((point) => point.at + DAY_MS));
    for (const column of ['cameras', 'mics', 'otherDevices', 'ports', 'faults', 'softwareUpdate', 'activeCameraId', 'diagnostics'] as const) {
      expect(two[column], column).toEqual(one[column]);
    }
    // The back-filled chart values are a function of the absolute time, so they are other
    // numbers on another day; their count and their keys are the same.
    expect(two.health.series).toHaveLength(one.health.series.length);
    expect(Object.keys(two.health)).toEqual(Object.keys(one.health));
  });
});

describe('two seeds with the same now give equal checksums on every table but the credentials (contract §9.6)', () => {
  it('equal for 26 tables; operator_credentials differs (a fresh salt per operator and per seed)', async () => {
    const twin = await db.another({ template: 'schema', slug: 'w20_clock_twin' });
    await seedDatabase(twin.ownerPool(), { now: LATER, target: 'test' });
    const first = await tableChecksums(dayTwoPool);
    const second = await tableChecksums(twin.ownerPool());
    expect(Object.keys(first)).toHaveLength(26);
    expect(second).toEqual(first);

    const salts = async (pool: Pool): Promise<string[]> =>
      (await pool.query<{ digest: string }>("SELECT md5(salt) AS digest FROM operator_credentials ORDER BY operator_id")).rows.map((row) => row.digest);
    const saltsFirst = await salts(dayTwoPool);
    const saltsSecond = await salts(twin.ownerPool());
    expect(saltsFirst).toHaveLength(3);
    for (const digest of saltsSecond) expect(saltsFirst).not.toContain(digest);
    // And another instant gives other checksums: the comparison can fail.
    const other = await tableChecksums(dayOnePool);
    expect(other['audit_log']).not.toBe(first['audit_log']);
    expect(other['roles']).toBe(first['roles']);
  });
});
