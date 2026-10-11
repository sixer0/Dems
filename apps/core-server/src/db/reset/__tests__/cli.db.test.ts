// `db:reset` end to end on databases of the test run (plan row W29; database contract §8.4, §8.5).
//
// The command is proven through the function its entry file calls, with the seam `testRunPrefix`,
// which no entry point sets and no argument or environment variable reaches. `dems_demo` and the
// lanes are never touched by a test (TI-17): how the three lane databases are built with the
// real command is recorded in the row's report.
import { mkdtempSync, rmSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEMO_OPERATOR_PASSWORD, DEMO_PAIRING_CODE } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useFurtherDatabase, useTestDatabase } from '../../../../test/helpers/db';
import type { CommandIo } from '../../commands/cli';
import { readOwnerConnection } from '../../commands/owner-connection';
import { runStatus } from '../../commands/status';
import { runReset, type ResetCommandOptions } from '../cli';
import { PATIENT_MS, catalogOf, dropOwn, maintenancePool, occurrences, plantKeptRows, quiet } from '../../../../test/support/reset';
import { coreFragmentSealer, sessionKeyStartRefusal } from '../../../sealing-host/session-key';
import { DISCARD_UNSEALED_FAKE_OPTION } from '../real-evidence';
import { RESET_CREDENTIAL_STORE_FOLDER, resetSessionKeyFolderOf } from '../session-artefacts';

const db = useTestDatabase({ template: 'seed', slug: 'rc' });
/** This file's database under a second name: a describe that keeps a further clone of its own calls that one `db`. */
const home = db;

// A reset under load takes a few times longer than on a quiet host: the limits are caps.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

/** 2026-10-04 11:00:00 WIB: a "now" of the command line, after the fixtures. */
const COMMAND_NOW = Date.UTC(2026, 9, 4, 4, 0, 0);
/** An empty media store root of this file's own (never the run's shared data directory). */
const MEDIA_ROOT = mkdtempSync(join(tmpdir(), 'dems-rc-media-'));
/** The row counts of contract §9.4 after a first seed of scenario `idle`: all 30 tables. */
const SEED_COUNTS: Readonly<Record<string, number>> = {
  active_session: 0,
  alerts: 0,
  audit_chain_head: 1,
  audit_chain_history: 0,
  audit_log: 82,
  auth_sessions: 0,
  biometric_tokens: 0,
  console_settings: 1,
  core_device: 1,
  core_state: 1,
  device_credentials: 0,
  engine_counters: 5,
  events: 59,
  evidence_custody: 28,
  evidence_items: 13,
  evidence_tracks: 52,
  exports: 1,
  hardware_snapshot: 1,
  health_snapshots: 0,
  operator_credentials: 3,
  operators: 3,
  paired_devices: 0,
  pairing_codes: 0,
  permissions: 14,
  registry_counters: 2,
  role_permissions: 22,
  roles: 3,
  schema_meta: 1,
  session_history: 13,
  storage_policy: 1,
};

let maintenance: Pool;
const printed: string[] = [];

beforeAll(() => {
  maintenance = maintenancePool(db.run.dataDir);
});

afterAll(async () => {
  await db.database.closeResources();
  for (const name of [`${db.name}_fb`, `${db.name}_next`, `${db.name}_prev`, db.name]) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance.end();
  rmSync(MEDIA_ROOT, { recursive: true, force: true });
});

function capture(): { io: CommandIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

async function reset(argv: string[], more: Partial<ResetCommandOptions> = {}): Promise<{ code: number; out: string[]; err: string[] }> {
  const { io, out, err } = capture();
  const code = await runReset(argv, {
    io,
    dataDir: db.run.dataDir,
    clock: () => COMMAND_NOW,
    // The routine's wait for sessions to end: generous where the reset must go through (it costs
    // nothing when no session is there); the one call that expects a refusal passes a short one.
    sessionDrainMs: PATIENT_MS,
    internals: { testRunPrefix: db.run.identity.prefix },
    // Since migration 0013 the command must know the media store root it judges (the variable of the
    // server, or the root a Core recorded in the database). These databases never had a Core: the
    // variable names an empty root of this file's own. The rules of that choice: `store-root.db.test.ts`.
    environment: { DEMS_MEDIA_DIR: MEDIA_ROOT },
    ...more,
  });
  printed.push(...out, ...err);
  console.log(`[w29] db:reset ${argv.join(' ')}: exit ${code}\n${[...out, ...err].map((line) => `  ${line}`).join('\n')}`);
  return { code, out, err };
}

describe('db:reset --database <a name that does not exist yet>: how a lane database comes into being', () => {
  it('exits 0, creates the database as dems_owner, and prints exactly the seed counts of contract §9.4', async () => {
    const name = `${db.name}_fb`;
    expect((await catalogOf(maintenance, [name]))[name]).toBeUndefined();
    let clockReads = 0;
    const { code, out, err } = await reset(['--database', name], { clock: () => ((clockReads += 1), COMMAND_NOW) });
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(clockReads).toBe(1);

    expect(out[0]).toBe(`db:reset: ${name} on PostgreSQL 18.4 as dems_owner`);
    expect(out[1]).toBe('db:reset: dataset as of 2026-10-04T04:00:00.000Z (1791086400000); scenario idle; reason RESET; actor none (command line)');
    expect(out[2]).toBe(`db:reset: first build: ${name} did not exist. Nothing was carried over and no chain was discarded; epoch 0.`);
    expect(out[3]).toMatch(/^db:reset: done in \d+ ms \(R-0 \d+, R-1 \d+, R-2 \d+, R-3 \d+, R-4 \d+, R-5 \d+, R-6 \d+, R-7 \d+, R-8 \d+, R-9 \d+\); the database now holds 314 row\(s\) in 24 of 43 table\(s\)$/);
    for (const [table, rows] of Object.entries(SEED_COUNTS)) expect(out).toContain(`  ${table.padEnd(24)} ${rows}`);
    expect(out.at(-3)).toMatch(/^audit head       seq 82; hash [0-9a-f]{16}\.\.\.$/);
    expect(out.at(-2)).toBe('lineage          0 row(s); 0 carried over, 0 appended');
    expect(out.at(-1)).toBe(`db:reset: OK: ${name} is reset. State: npm run db:status -w @dems/core-server -- --database ${name}`);

    // `db:status` of the new database: owner dems_owner, the seed counts, exit 0.
    const status = capture();
    const statusCode = await runStatus(['--database', name], { io: status.io, dataDir: db.run.dataDir, allowTestDatabase: true });
    expect(statusCode).toBe(0);
    expect(status.out).toContain('owner            dems_owner; encoding UTF8; locale C');
    expect(status.out).toContain('lineage          0 row(s)');
    expect(status.out).toContain('audit triggers   audit_chain_history_append_only=A, audit_log_append_only=A, audit_log_chain_guard=A');
    for (const [table, rows] of Object.entries(SEED_COUNTS)) expect(status.out).toContain(`  ${table.padEnd(24)} ${rows}`);
    expect(status.out.at(-1)).toBe(`db:status: OK: ${name} is at the schema version this code expects and the ledger matches the files.`);
    expect(status.out.find((line) => line.startsWith('last_reset_at'))).toBe('last_reset_at    2026-10-04T04:00:00.000Z (1791086400000)');
  });

  it('a second run of the same command resets it: one lineage row, the SCENARIO_LOADED row, epoch 0 -> 1', async () => {
    const name = `${db.name}_fb`;
    const { code, out, err } = await reset(['--database', name, '--scenario', 'recording'], { clock: () => COMMAND_NOW + 60_000 });
    expect(code).toBe(0);
    expect(err).toEqual([]);
    expect(out).toContain('db:reset: epoch 0 -> 1');
    expect(out).toContain('db:reset: dataset as of 2026-10-04T04:01:00.000Z (1791086460000); scenario recording; reason RESET; actor none (command line)');
    expect(out.some((line) => /^db:reset: discarded chain: reset_no 1, epoch 0, rows 82, first_seq 1, last_seq 82, head [0-9a-f]{64}$/.test(line))).toBe(true);
    // DC-7: one log line with the same values.
    expect(out.some((line) => new RegExp(`^db:reset: audit chain of ${name} discarded: 82 row\\(s\\), head [0-9a-f]{64}\\.$`).test(line))).toBe(true);
    expect(out.at(-2)).toBe('lineage          1 row(s); 0 carried over, 1 appended');
    expect(out).toContain(`  ${'active_session'.padEnd(24)} 1`);
  });
});

describe('db:reset on a used database', () => {
  it('exits 1 and changes nothing while the database is in use; then exits 0 and keeps the kept tables', async () => {
    await plantKeptRows(db.ownerPool());
    const oid = (await catalogOf(maintenance, [db.name]))[db.name]?.oid;

    // The test's own pool is still open: a session on the target, like a lane backend that still runs.
    const busy = await reset(['--database', db.name], { sessionDrainMs: 300 });
    expect(busy.code).toBe(1);
    expect(busy.out).toEqual([]);
    expect(busy.err).toEqual([
      `db:reset: refused: ${db.name} is in use (1 of role dems_owner on ${db.name}). The reset ends nobody's session: stop the server of this database, or close its pool, and run again. Nothing was changed.`,
      'db:reset: NOT RESET (RESET_TARGET_IN_USE at R-1); the database is unchanged.',
    ]);
    expect((await catalogOf(maintenance, [db.name]))[db.name]?.oid).toBe(oid);

    await quiet(maintenance, db.database);
    const done = await reset(['--database', db.name]);
    expect(done.code).toBe(0);
    expect(done.err).toEqual([]);
    expect(done.out).toContain('db:reset: epoch 0 -> 1');
    expect(done.out).toContain(
      'db:reset: kept tables carried over unchanged (rows): registry_counters 2, console_settings 1, pairing_codes 5, paired_devices 2, device_credentials 2, auth_sessions 3, biometric_tokens 3, capture_devices 5, capture_device_credentials 0, capture_config 1, stt_config 1, core_media_store 0, audit_chain_history 0',
    );
    expect(done.out).toContain('db:reset: pairing codes that were ACTIVE, now CANCELLED: 1; operators with a last sign-in from a kept session: 2');
    expect(done.out).toContain('db:reset: SCENARIO_LOADED is audit row 83 of the new chain');
    expect((await catalogOf(maintenance, [db.name]))[db.name]?.oid).not.toBe(oid);
    // From the command line the reset has no actor: the code is closed by nobody, the lineage row has none.
    const closed = await db.ownerPool().query("SELECT closed_by_operator_id FROM public.pairing_codes WHERE id = 'PCD-000005'");
    expect(closed.rows).toEqual([{ closed_by_operator_id: null }]);
    const lineage = await db.ownerPool().query('SELECT actor_id, reason, scenario FROM public.audit_chain_history');
    expect(lineage.rows).toEqual([{ actor_id: null, reason: 'RESET', scenario: 'idle' }]);
  });

  it('a name of another run, a template and a project name with a suffix are refused with exit 2', async () => {
    for (const name of [`${db.run.identity.prefix}tpl_seed`, 'dems_test_step_51_zzzz9999_f01_rc', `${db.name}_next`]) {
      const { code, out, err } = await reset(['--database', name]);
      expect(code, name).toBe(2);
      expect(out).toEqual([]);
      expect(err).toHaveLength(1);
      expect(err[0]).toMatch(/^db:reset: refused before any connection: /);
    }
  });
});

describe('nothing the command printed is a credential', () => {
  it('neither role password, no demo password, no pairing code, and no hash of a kept row occurs in any line', async () => {
    expect(printed.length).toBeGreaterThan(100);
    const everything = printed.join('\n');
    // The owner's password, read here only to be searched for; it is never printed.
    const ownerPassword = readOwnerConnection(db.run.dataDir).password.reveal();
    const appPassword = db.runtime.password.reveal();
    expect(ownerPassword.length).toBeGreaterThanOrEqual(24);
    expect(occurrences(everything, ownerPassword)).toBe(0);
    expect(occurrences(everything, appPassword)).toBe(0);
    const demoPassword: string = DEMO_OPERATOR_PASSWORD;
    const demoCode: string = DEMO_PAIRING_CODE;
    expect(occurrences(everything, demoPassword)).toBe(0);
    expect(occurrences(everything, demoCode)).toBe(0);
    expect(everything).not.toMatch(/DEMS_PG_[A-Z_]*PASSWORD/);

    // No token hash, credential hash or code hash of a kept row, and no password salt or hash.
    const hashes = await db.ownerPool().query<{ hex: string }>(
      "SELECT encode(token_hash, 'hex') AS hex FROM public.auth_sessions UNION ALL SELECT encode(token_hash, 'hex') FROM public.biometric_tokens " +
        "UNION ALL SELECT encode(current_hash, 'hex') FROM public.device_credentials UNION ALL SELECT encode(code_hash, 'hex') FROM public.pairing_codes " +
        "UNION ALL SELECT encode(salt, 'hex') FROM public.operator_credentials UNION ALL SELECT encode(hash, 'hex') FROM public.operator_credentials",
    );
    expect(hashes.rows.length).toBe(3 + 3 + 2 + 5 + 3 + 3);
    for (const { hex } of hashes.rows) {
      expect(occurrences(everything, hex)).toBe(0);
      expect(occurrences(everything, hex.slice(0, 16))).toBe(0);
    }
  });
});

// ═══ Moved here from `wave-i-a1-reset-lane.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
// Fix wave I, driver A1 (re-gate 75 finding G75b-01; ruling D216) - THE WHOLE RESET, as `db:reset`
// runs it, on the state lane 2 was left in:
//
//   - a session of four generated (FAKE) sources whose seal failed: its recording folder, without a
//     manifest, in the media store;
//   - in the key folder of that store: the key an EARLIER session of the same number left (made by
//     a build that bound no key to its session; the database names that earlier session no more)
//     and the key of another earlier session.
//
// Before the fix: exit 1 RESET_BLOCKED_REAL_EVIDENCE for ever, and - had the reset run - both keys
// would have survived it. After: the same refusal WITHOUT the explicit word (and it names the
// word); WITH it the reset runs, removes the folder, and destroys every session key of the store.
//
// A throw-away database of this file (never `dems_demo`, never a lane) and folders of its own.
describe('G75b-01, D216: db:reset on a development lane whose seal failed', () => {
  const db = useFurtherDatabase(home, { template: 'seed', slug: 'wia1lane' });
  /**
   * The media store root of THIS file, outside the data directory. The reset finds the session keys
   * below the data directory of the run (`<dataDir>/credential-store/session-keys-<scope of the
   * root>`): a key folder of this root alone, made by this file and removed by it - no other folder
   * of the credential store is read or written.
   */
  const scratch = mkdtempSync(join(tmpdir(), 'dems-wia1-data-'));
  const mediaRoot = join(scratch, 'media', 'lane', 'sessions');
  const SESSION = 'SES-20261010-0025';
  const EARLIER = 'SES-20261010-0024';
  const keyFolder = (): string => join(db.run.dataDir, RESET_CREDENTIAL_STORE_FOLDER, resetSessionKeyFolderOf(mediaRoot));
  const host = () => ({ stages: {}, config: { dataDir: db.run.dataDir, mediaStoreDir: mediaRoot } });
  let maintenance: Pool;

  async function reset(args: readonly string[]): Promise<{ code: number; out: string[]; err: string[] }> {
    const out: string[] = [];
    const err: string[] = [];
    const io: CommandIo = { out: (line) => out.push(line), err: (line) => err.push(line) };
    const code = await runReset(['--database', db.name, ...args], { io, dataDir: db.run.dataDir, evidenceStoreDir: mediaRoot, clock: () => Date.UTC(2026, 9, 10, 13, 30, 0), sessionDrainMs: PATIENT_MS, internals: { testRunPrefix: db.run.identity.prefix } });
    console.log(`[wave I A1] db:reset ${args.join(' ')}: exit ${code}\n${[...out, ...err].map((line) => `  ${line}`).join('\n')}`);
    return { code, out, err };
  }

  beforeAll(async () => {
    maintenance = maintenancePool(db.run.dataDir);
    const owner = db.ownerPool();
    const cameras = (await owner.query<{ id: string }>("SELECT id FROM public.capture_devices WHERE id LIKE 'CAM-%' ORDER BY id LIMIT 2")).rows.map((row) => row.id);
    const microphones = (await owner.query<{ id: string }>("SELECT id FROM public.capture_devices WHERE id LIKE 'MIC-%' ORDER BY id LIMIT 2")).rows.map((row) => row.id);
    await owner.query(
      `INSERT INTO public.session_capture_sources (session_id, slot, device_id, adapter_kind, recorded_at) VALUES
       ($1, 'VIDEO-01', $2, 'FAKE', 1791600000000), ($1, 'VIDEO-02', $3, 'FAKE', 1791600000000),
       ($1, 'MIC-PRIMARY', $4, 'FAKE', 1791600000000), ($1, 'MIC-STANDBY', $5, 'FAKE', 1791600000000)`,
      [SESSION, cameras[0], cameras[1], microphones[0], microphones[1]],
    );
    // The recording folder of the session whose seal failed: camera files, a part file, no manifest.
    mkdirSync(join(mediaRoot, `SESSION-${SESSION}`, 'fragments'), { recursive: true });
    writeFileSync(join(mediaRoot, `SESSION-${SESSION}`, 'VIDEO-01.mp4'), 'generated test picture');
    writeFileSync(join(mediaRoot, `SESSION-${SESSION}`, 'fragments', 'VIDEO-01.mp4.seal.part'), 'part');
    mkdirSync(join(mediaRoot, '.capture-session'), { recursive: true });
    writeFileSync(join(mediaRoot, '.capture-session', `${EARLIER}.json`), '{}');
    // The keys the older build left: a key file each, no binding.
    coreFragmentSealer(host()).seal(SESSION, { trackId: 'VIDEO-01', seq: 1, byteOffset: 800 }, new Uint8Array(64));
    coreFragmentSealer(host()).seal(EARLIER, { trackId: 'VIDEO-01', seq: 1, byteOffset: 800 }, new Uint8Array(64));
  });

  afterAll(async () => {
    await db.database.closeResources();
    for (const name of [`${db.name}_next`, `${db.name}_prev`, db.name]) await dropOwn(maintenance, name, db.run.identity.prefix);
    await maintenance.end();
    rmSync(scratch, { recursive: true, force: true });
    // The key folder of this file's own media root, and nothing beside it.
    if (/[/\\]session-keys-[0-9a-f]{32}$/.test(keyFolder())) rmSync(keyFolder(), { recursive: true, force: true });
  });

  describe('G75b-01: a development lane whose seal failed can be reset again - on the explicit word only', () => {
    it('the state lane 2 was in: both keys are there without a binding, and a session of either number would be refused its start', () => {
      expect(readdirSync(keyFolder()).sort()).toEqual([`KID-${EARLIER}.key`, `KID-${SESSION}.key`]);
      expect(sessionKeyStartRefusal(host(), SESSION)).toBe('SESSION_KEY_NOT_OF_SESSION');
    });

    it('WITHOUT the word (control, and the reproduction): exit 1 RESET_BLOCKED_REAL_EVIDENCE, the option is named, nothing was changed', async () => {
      const run = await reset([]);
      expect(run.code).toBe(1);
      const text = run.err.join('\n');
      expect(text).toContain('RESET_BLOCKED_REAL_EVIDENCE');
      expect(text).toContain(`1 unreadable package director(y/ies) [SESSION-${SESSION}]`);
      expect(text).toContain(DISCARD_UNSEALED_FAKE_OPTION);
      expect(existsSync(join(mediaRoot, `SESSION-${SESSION}`, 'VIDEO-01.mp4'))).toBe(true);
      expect(readdirSync(keyFolder()).sort()).toEqual([`KID-${EARLIER}.key`, `KID-${SESSION}.key`]);
      expect((await db.ownerPool().query('SELECT count(*)::int AS n FROM public.session_capture_sources WHERE session_id = $1', [SESSION])).rows).toEqual([{ n: 4 }]);
    });

    it('WITH the word: exit 0; the reset says what it erases, removes the recording folder, destroys EVERY session key of the store (the two of unknown sessions among them) and the stale facts file; a session of the number starts and seals under a new key', async () => {
      const run = await reset([DISCARD_UNSEALED_FAKE_OPTION]);
      expect(run.code).toBe(0);
      const text = [...run.out, ...run.err].join('\n');
      expect(text).toContain(`this reset erases 1 unsealed recording folder(s) of ${db.name} that were recorded from generated (FAKE) sources only and were never sealed [SESSION-${SESSION}]`);
      expect(text).toContain(`removed 1 unsealed recording folder(s) of generated sources from the evidence store: SESSION-${SESSION}.`);
      expect(text).toMatch(/destroyed the session key of 2 cleared session\(s\) \(KID-SES-20261010-002[45], KID-SES-20261010-002[45]\)/);
      expect(text).toContain('1 of them were keys of sessions this database did not name (left by an earlier reset)');
      expect(text).not.toContain('RESET_SESSION_ARTEFACT_LEFT');
      expect(existsSync(join(mediaRoot, `SESSION-${SESSION}`))).toBe(false);
      expect(readdirSync(keyFolder())).toEqual([]);
      expect(existsSync(join(mediaRoot, '.capture-session', `${EARLIER}.json`))).toBe(false);
      // No key byte and no path of the key store in what the command printed.
      expect(text).not.toContain(keyFolder());
      // The lane is usable: the session of that number is not refused, and its seal makes a key bound to it.
      expect(sessionKeyStartRefusal(host(), SESSION)).toBeNull();
      coreFragmentSealer(host(), () => 'created-1791636741000').seal(SESSION, { trackId: 'VIDEO-01', seq: 1, byteOffset: 800 }, new Uint8Array(64));
      expect(readdirSync(keyFolder()).sort()).toEqual([`KID-${SESSION}.blob`, `KID-${SESSION}.key`]);
      // The database is the seeded one again: the session's source rows are gone with it.
      expect((await db.ownerPool().query('SELECT count(*)::int AS n FROM public.session_capture_sources WHERE session_id = $1', [SESSION])).rows).toEqual([{ n: 0 }]);
    });
  });
});
