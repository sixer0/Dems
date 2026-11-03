// The FACTORY seed (`db:seed --factory`): what it writes, what it refuses, database-free.
// PT GSP's ruling of 30 Oct 2026: a unit leaving the workshop holds the two vendor identities and
// none of the demonstration dataset. The demonstration seed is tested by cli.test.ts / seed.db.test.ts.
import { FACTORY_OPERATORS, OPERATORS, OPERATOR_IDS } from '@dems/shared/sim';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { CommandIo } from '../../commands/cli';
import { countRows } from '../../mapping';
import { runSeed } from '../cli';
import { CERT_FINGERPRINT_PATTERN, ENV_DEVICE_CERT_FINGERPRINT, FACTORY_EMPTY_TABLES, FactorySeedError, factoryIdentityOfEnvironment, prepareFactorySeed } from '../factory';

const FIXED_NOW = 1_790_823_600_000; // 2026-10-01T03:00:00.000Z
const IDENTITY = { installationDeviceId: 'DEMS-BENCH-01', installationName: 'DEMS Bench GSP', certificateFingerprint: '0C:86:21:74:C3:33:AC:07:21:E8:9C:FE:CE:D9:99:85' };
const ENV = { DEMS_INSTALLATION_DEVICE_ID: IDENTITY.installationDeviceId, DEMS_INSTALLATION_NAME: IDENTITY.installationName, [ENV_DEVICE_CERT_FINGERPRINT]: IDENTITY.certificateFingerprint };

/** The environment of a Core that was handed nothing of its own name. */
const NO_ENV: Readonly<Record<string, string | undefined>> = {};

function capture(): { io: CommandIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

describe('factoryIdentityOfEnvironment: a factory seed names THIS unit, never the demonstration one', () => {
  it('the three keys of the Core are enough, and the fingerprint keeps its stored form', () => {
    const answer = factoryIdentityOfEnvironment(ENV);
    expect(answer).toEqual({ ok: true, identity: IDENTITY });
  });

  it('a lowercase fingerprint is normalised, not refused', () => {
    const answer = factoryIdentityOfEnvironment({ ...ENV, [ENV_DEVICE_CERT_FINGERPRINT]: IDENTITY.certificateFingerprint.toLowerCase() });
    expect(answer.ok === true && answer.identity.certificateFingerprint).toBe(IDENTITY.certificateFingerprint);
  });

  it.each([
    ['the device id', 'DEMS_INSTALLATION_DEVICE_ID'],
    ['the installation name', 'DEMS_INSTALLATION_NAME'],
    ['the certificate fingerprint', ENV_DEVICE_CERT_FINGERPRINT],
  ])('%s missing: refused, and the refusal names the key', (_label, key) => {
    const answer = factoryIdentityOfEnvironment({ ...ENV, [key]: '' });
    expect(answer.ok).toBe(false);
    expect(answer.ok === false ? answer.problem : null).toEqual({ code: 'IDENTITY_MISSING', keys: [key] });
  });

  it.each([
    ['a demonstration id (reserved for the tests and the published data)', { DEMS_INSTALLATION_DEVICE_ID: 'DEMS-IR-01' }],
    ['a test id', { DEMS_INSTALLATION_DEVICE_ID: 'DEMS-TEST-01' }],
    ['an id of another shape', { DEMS_INSTALLATION_DEVICE_ID: 'bench 01' }],
    ['a fingerprint of another shape', { [ENV_DEVICE_CERT_FINGERPRINT]: 'bukan-sandi-dan-bukan-fingerprint' }],
    ['a fingerprint of the wrong length', { [ENV_DEVICE_CERT_FINGERPRINT]: '0C:86:21' }],
  ])('%s: refused as invalid', (_label, over) => {
    const answer = factoryIdentityOfEnvironment({ ...ENV, ...over });
    expect(answer.ok).toBe(false);
    expect(answer.ok === false ? answer.problem.code : null).toBe('IDENTITY_INVALID');
  });

  it('the fingerprint pattern is the stored form: sixteen colon-separated byte pairs', () => {
    expect(CERT_FINGERPRINT_PATTERN.test(IDENTITY.certificateFingerprint)).toBe(true);
    expect(CERT_FINGERPRINT_PATTERN.test('0C:86:21:74:C3:33:AC:07:21:E8:9C:FE:CE:D9:99:85:BF')).toBe(false);
  });
});

describe('prepareFactorySeed: the rows a factory database holds', () => {
  it('the two vendor identities, and no identity of the demonstration dataset', async () => {
    const prepared = await prepareFactorySeed({ now: FIXED_NOW }, IDENTITY);
    expect(prepared.rows.operators.map((row) => [row.id, row.username, row.roleId])).toEqual([
      [OPERATOR_IDS.VENDOR_ROOT, 'root', 'SUPERVISOR'],
      [OPERATOR_IDS.VENDOR_TEKNISI, 'gsp.teknisi', 'TECHNICIAN'],
    ]);
    expect(prepared.rows.operators.map((row) => row.id)).toEqual(FACTORY_OPERATORS.map((operator) => operator.id));
    const demoIds = OPERATORS.map((operator) => operator.id);
    expect(prepared.rows.operators.some((row) => demoIds.includes(row.id))).toBe(false);
    // Enabled, never signed in, no role change: the account waits for the human who sets its password.
    expect(prepared.rows.operators.every((row) => row.enabled === true && row.lastSignInAt === null && row.roleChangedAt === null)).toBe(true);
  });

  it('no credential is derived: the factory seed holds no hasher and no credential row', async () => {
    const prepared = await prepareFactorySeed({ now: FIXED_NOW }, IDENTITY);
    // `operator_credentials` is not one of the mapped tables, and the prepared seed carries no
    // credential member at all: there is nothing for a writer to insert.
    expect(Object.keys(prepared)).not.toContain('credentials');
    expect(countRows(prepared.rows)).not.toHaveProperty('operator_credentials');
  });

  it('every table of the demonstration dataset is left empty', async () => {
    const prepared = await prepareFactorySeed({ now: FIXED_NOW }, IDENTITY);
    const counts = countRows(prepared.rows);
    for (const table of FACTORY_EMPTY_TABLES) {
      if (table === 'operator_credentials') continue;
      expect([table, counts[table]], table).toEqual([table, 0]);
    }
  });

  it('the chain stays at its genesis, so B-6 sees a seed and B-7 sees an empty chain', async () => {
    const prepared = await prepareFactorySeed({ now: FIXED_NOW }, IDENTITY);
    expect(prepared.expectedHead).toEqual({ seq: 0, hash: prepared.state.audit.head });
    expect(prepared.state.audit.rows).toEqual([]);
    expect(prepared.rows.auditChainHead).toEqual([{ singleton: true, seq: 0, hash: prepared.state.audit.head }]);
  });

  it('the unit is named by its own configuration, not by the demonstration device', async () => {
    const prepared = await prepareFactorySeed({ now: FIXED_NOW }, IDENTITY);
    const device = prepared.rows.coreDevice[0]!;
    expect([device.id, device.name, device.room, device.certificateFingerprint]).toEqual([
      IDENTITY.installationDeviceId, IDENTITY.installationName, IDENTITY.installationName, IDENTITY.certificateFingerprint,
    ]);
    // The hardware identity is provisioning's to fill: nothing invented here.
    expect(device.serialNumber).toBe('');
    expect(device.provisioningRecordId).toBe('');
  });

  it('the configuration singletons boot needs are written once each', async () => {
    const prepared = await prepareFactorySeed({ now: FIXED_NOW }, IDENTITY);
    const counts = countRows(prepared.rows);
    expect([counts.core_state, counts.core_device, counts.storage_policy, counts.console_settings, counts.hardware_snapshot, counts.capture_config]).toEqual([1, 1, 1, 1, 1, 1]);
    expect(counts.capture_devices).toBe(0);
    // The two registry counters of contract §4.11 start at 1: no pairing code and no export exists.
    expect(prepared.registryCounters).toEqual([{ name: 'device', nextValue: 1 }, { name: 'pairingCode', nextValue: 1 }]);
    expect(prepared.rows.engineCounters).toHaveLength(5);
    expect(prepared.rows.engineCounters.every((row) => row.nextValue === 1)).toBe(true);
  });

  it('the RBAC vocabulary is the shared one, untouched', async () => {
    const prepared = await prepareFactorySeed({ now: FIXED_NOW }, IDENTITY);
    expect(prepared.rbac.roles.map((row) => row.id)).toEqual(['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN']);
    expect(prepared.rbac.permissions.length).toBeGreaterThan(0);
    expect(prepared.rbac.rolePermissions.length).toBeGreaterThan(0);
  });

  it('the epoch of a reset continues, as in the demonstration seed', async () => {
    const prepared = await prepareFactorySeed({ now: FIXED_NOW, epoch: 4 }, IDENTITY);
    expect(prepared.state.meta.epoch).toBe(4);
    expect(prepared.options.epoch).toBe(4);
  });

  it('a clock that is not a positive whole number is refused before any row is built', async () => {
    await expect(prepareFactorySeed({ now: 0 }, IDENTITY)).rejects.toBeInstanceOf(FactorySeedError);
  });
});

describe('db:seed --factory: the wrong calls', () => {
  /**
   * A data directory of its own holding an owner connection file that is never used: the command
   * reads that file before its body runs, so this is how a test reaches the body without a
   * database. The endpoint is the project's, the password is nonsense, and no connection is opened
   * because every case below stops before the first pool.
   */
  const ownerDir = mkdtempSync(join(tmpdir(), 'dems-factory-seed-'));
  const ownerFile = join(ownerDir, 'pg.owner.env');
  writeFileSync(ownerFile, ['DEMS_PG_HOST=127.0.0.1', 'DEMS_PG_PORT=4432', 'DEMS_PG_DATABASE=dems_demo', 'DEMS_PG_OWNER_ROLE=dems_owner', 'DEMS_PG_OWNER_PASSWORD=tidak-dipakai-tes-ini'].join('\n'), { mode: 0o600 });
  afterAll(() => rmSync(ownerDir, { recursive: true, force: true }));

  it('the flag is an option of this command, unlike one the parser does not know', async () => {
    const { io, out, err } = capture();
    const code = await runSeed(['--database', 'dems_lane_1', '--factory'], { io, dataDir: '/nonexistent/dems-factory' });
    expect(code).toBe(1);
    // The owner file is the frame's, read before the body: the flag did not reach a database.
    expect(out).toEqual([]);
    expect(err.at(-1)).toMatch(/cannot be read \(ENOENT\)/);
  });

  it.each([
    ['--factory twice', ['--database', 'dems_lane_1', '--factory', '--factory']],
    ['--factory with a value', ['--database', 'dems_lane_1', '--factory=yes']],
    ['an unknown option beside the flag', ['--database', 'dems_lane_1', '--factory', '--scenario', 'idle']],
    ['a refused database name', ['--database', 'dems_demo_next', '--factory']],
  ])('%s: exit 2, nothing printed', async (_label, argv) => {
    const { io, out, err } = capture();
    expect(await runSeed(argv, { io, dataDir: '/nonexistent/dems-factory' })).toBe(2);
    expect(out).toEqual([]);
    expect(err.length).toBeGreaterThan(0);
  });

  it('a unit whose name is unknown is refused before any pool is opened', async () => {
    const { io, out, err } = capture();
    const code = await runSeed(['--database', 'dems_lane_1', '--factory'], { io, dataDir: ownerDir, environment: {}, clock: () => FIXED_NOW });
    expect(code).toBe(1);
    expect(out).toEqual(["db:seed: FACTORY mode - the two vendor identities with no credential row, this unit's own name, and no row of the demonstration dataset."]);
    expect(err.join('\n')).toContain("IDENTITY_MISSING - the factory seed needs the unit's own identity in DEMS_INSTALLATION_DEVICE_ID, DEMS_INSTALLATION_NAME, DEMS_DEVICE_CERT_FINGERPRINT.");
    expect(err.at(-1)).toBe('db:seed: NOT SEEDED (IDENTITY_MISSING).');
  });

});
