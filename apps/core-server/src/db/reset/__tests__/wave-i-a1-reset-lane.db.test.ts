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
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { PATIENT_MS, dropOwn, maintenancePool } from '../../../../test/support/reset';
import { coreFragmentSealer, sessionKeyStartRefusal } from '../../../sealing-host/session-key';
import type { CommandIo } from '../../commands/cli';
import { runReset } from '../cli';
import { DISCARD_UNSEALED_FAKE_OPTION } from '../real-evidence';
import { RESET_CREDENTIAL_STORE_FOLDER, resetSessionKeyFolderOf } from '../session-artefacts';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed', slug: 'wia1lane' });
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
