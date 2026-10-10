// Fix wave I, driver A1 (re-gate 75 finding G75b-01; ruling D216) ON POSTGRESQL: the third branch of
// the guard's ONE statement - sessions of exactly four source rows, all generated (FAKE), without a
// sealed item - says on the real tables what the unit file `wave-i-a1-unsealed-fake.test.ts` rules,
// and the two branches before it answer as they did.
//
// A throw-away database of this file (never `dems_demo`, never a lane). No reset is run here.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { REAL_SEALED_EVIDENCE_STATEMENT, UNSEALED_FAKE_SOURCE, findRealSealedEvidence, removeUnsealedFakeRecordings, type RealSealedEvidenceRow } from '../real-evidence';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed', slug: 'wia1rst' });
const storeRoot = mkdtempSync(join(tmpdir(), 'dems-wia1-guard-'));
afterAll(() => rmSync(storeRoot, { recursive: true, force: true }));

const GENERATED = 'SES-20261010-9101';
const LOCAL = 'SES-20261010-9102';
const PRODUCTION = 'SES-20261010-9103';
const THREE = 'SES-20261010-9104';
let cameras: string[] = [];
let microphones: string[] = [];

async function sources(sessionId: string, kinds: readonly string[]): Promise<void> {
  const slots = ['VIDEO-01', 'VIDEO-02', 'MIC-PRIMARY', 'MIC-STANDBY'];
  const devices = [cameras[0], cameras[1], microphones[0], microphones[1]];
  for (const [index, kind] of kinds.entries()) {
    await db.ownerPool().query('INSERT INTO public.session_capture_sources (session_id, slot, device_id, adapter_kind, recorded_at) VALUES ($1, $2, $3, $4, 1791600000000)', [sessionId, slots[index], devices[index], kind]);
  }
}
const folder = (sessionId: string): void => {
  mkdirSync(join(storeRoot, `SESSION-${sessionId}`), { recursive: true });
  writeFileSync(join(storeRoot, `SESSION-${sessionId}`, 'VIDEO-01.mp4'), 'generated test picture');
};
const fakeRows = async (): Promise<string[]> => (await db.ownerPool().query<RealSealedEvidenceRow>(REAL_SEALED_EVIDENCE_STATEMENT)).rows.filter((row) => row.integrity_source === UNSEALED_FAKE_SOURCE).map((row) => row.session_id);

beforeAll(async () => {
  const owner = db.ownerPool();
  cameras = (await owner.query<{ id: string }>("SELECT id FROM public.capture_devices WHERE id LIKE 'CAM-%' ORDER BY id LIMIT 2")).rows.map((row) => row.id);
  microphones = (await owner.query<{ id: string }>("SELECT id FROM public.capture_devices WHERE id LIKE 'MIC-%' ORDER BY id LIMIT 2")).rows.map((row) => row.id);
  expect([cameras.length, microphones.length]).toEqual([2, 2]);
});

describe('rules (12) + (13) on the real tables', () => {
  it('CONTROL: the seeded database names no such session, and the statement runs for the runtime role too', async () => {
    expect(await fakeRows()).toEqual([]);
    await expect(db.appPool().query(REAL_SEALED_EVIDENCE_STATEMENT)).resolves.toBeDefined();
  });

  it('four FAKE source rows without a sealed item ARE named; LOCAL_DEVICE among them, a production kind among them, and three rows are NOT (negative controls)', async () => {
    await sources(GENERATED, ['FAKE', 'FAKE', 'FAKE', 'FAKE']);
    await sources(LOCAL, ['FAKE', 'LOCAL_DEVICE', 'FAKE', 'FAKE']);
    await sources(PRODUCTION, ['FAKE', 'ONVIF_RTSP', 'FAKE', 'FAKE']);
    await sources(THREE, ['FAKE', 'FAKE', 'FAKE']);
    expect(await fakeRows()).toEqual([GENERATED]);
  });

  it('the store as a failed seal leaves it: every one of the four folders BLOCKS without the word; with the word ONLY the generated one is cleared and removed, the three others still block', async () => {
    for (const sessionId of [GENERATED, LOCAL, PRODUCTION, THREE]) folder(sessionId);
    const without = await findRealSealedEvidence(db.ownerPool(), { database: db.name, storeRoot });
    expect(without).toMatchObject({ blocked: true, unsealedFakeOffered: 1, unsealedFakeFolders: [] });
    expect(without.unprovablePackages).toEqual([GENERATED, LOCAL, PRODUCTION, THREE].map((sessionId) => `SESSION-${sessionId}`));
    const withWord = await findRealSealedEvidence(db.ownerPool(), { database: db.name, storeRoot, discardUnsealedFake: true });
    expect(withWord).toMatchObject({ blocked: true, unsealedFakeFolders: [`SESSION-${GENERATED}`] });
    expect(withWord.unprovablePackages).toEqual([LOCAL, PRODUCTION, THREE].map((sessionId) => `SESSION-${sessionId}`));
    // The production recording that is not sealed is still named by rule (10).
    expect(withWord.unsealedSessions).toEqual([PRODUCTION]);
    // Blocked: nothing is removed.
    expect(removeUnsealedFakeRecordings(withWord)).toEqual({ removed: [], kept: [] });
    for (const sessionId of [LOCAL, PRODUCTION, THREE]) rmSync(join(storeRoot, `SESSION-${sessionId}`), { recursive: true });
  });
});
