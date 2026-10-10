// Fix pass F-M7 (review row 88, R88-09 (2); decision D178) ON POSTGRESQL: the guard's ONE statement
// names a session that recorded from a production-class source and is neither sealed nor
// terminally closed - and only such a session. The unit file `real-evidence-m7.test.ts` holds the
// rule; this file holds that the SQL says the same on the real tables, as the routine asks it.
//
// A throw-away database of this file (never `dems_demo`, never a lane). No reset is run here.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { assertNoRealSealedEvidence, findRealSealedEvidence } from '../real-evidence';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed', slug: 'm7rst' });
const storeRoot = join(mkdtempSync(join(tmpdir(), 'dems-fm7-guard-')), 'never-made');
afterAll(() => rmSync(join(storeRoot, '..'), { recursive: true, force: true }));

const PRODUCTION = 'SES-20261010-9001';
const DEVELOPMENT = 'SES-20261010-9002';
const MIXED = 'SES-20261010-9003';
let cameras: string[] = [];
let microphones: string[] = [];

async function sources(sessionId: string, kinds: readonly [string, string, string, string]): Promise<void> {
  await db.ownerPool().query(
    `INSERT INTO public.session_capture_sources (session_id, slot, device_id, adapter_kind, recorded_at) VALUES
       ($1, 'VIDEO-01', $2, $6, 1791600000000), ($1, 'VIDEO-02', $3, $7, 1791600000000),
       ($1, 'MIC-PRIMARY', $4, $8, 1791600000000), ($1, 'MIC-STANDBY', $5, $9, 1791600000000)`,
    [sessionId, cameras[0], cameras[1], microphones[0], microphones[1], ...kinds],
  );
}
const facts = () => findRealSealedEvidence(db.ownerPool(), { database: db.name, storeRoot });

beforeAll(async () => {
  const owner = db.ownerPool();
  cameras = (await owner.query<{ id: string }>("SELECT id FROM public.capture_devices WHERE id LIKE 'CAM-%' ORDER BY id LIMIT 2")).rows.map((row) => row.id);
  microphones = (await owner.query<{ id: string }>("SELECT id FROM public.capture_devices WHERE id LIKE 'MIC-%' ORDER BY id LIMIT 2")).rows.map((row) => row.id);
  expect([cameras.length, microphones.length]).toEqual([2, 2]);
});

describe('R88-09 (2) on the real tables', () => {
  it('CONTROL: the seeded database, with no store, names no unsealed session', async () => {
    expect(await facts()).toMatchObject({ unsealedSessions: [], storeUnreadable: null, quarantinedSessions: [] });
  });

  it('a session with four production source rows, no sealed item and no history entry BLOCKS and is named; the guard throws', async () => {
    const before = (await facts()).blocked;
    await sources(PRODUCTION, ['ONVIF_RTSP', 'ONVIF_RTSP', 'USB_AUDIO', 'USB_AUDIO']);
    const now = await facts();
    expect(now).toMatchObject({ blocked: true, unsealedSessions: [PRODUCTION] });
    expect(now.dbSessions).toContain(PRODUCTION);
    await expect(assertNoRealSealedEvidence(db.ownerPool(), { database: db.name, storeRoot })).rejects.toMatchObject({ code: 'RESET_BLOCKED_REAL_EVIDENCE', step: 'R-0' });
    // The same question as the runtime role (the server's pre-flight of operation 75): it may ask it, and reads the same.
    expect((await findRealSealedEvidence(db.appPool(), { database: db.name, storeRoot })).unsealedSessions).toEqual([PRODUCTION]);
    expect(typeof before).toBe('boolean');
  });

  it('CONTROL: four DEVELOPMENT source rows without an item are not named (R88-10 is their rule); ONE production row among them is (fail closed)', async () => {
    await sources(DEVELOPMENT, ['FAKE', 'LOCAL_DEVICE', 'FAKE', 'LOCAL_DEVICE']);
    await sources(MIXED, ['FAKE', 'ONVIF_RTSP', 'FAKE', 'FAKE']);
    expect((await facts()).unsealedSessions).toEqual([PRODUCTION, MIXED]);
  });

  it('CONTROL: a session that is terminally closed (a history entry) is no longer named', async () => {
    await db.ownerPool().query(
      `INSERT INTO public.session_history (id, outcome, case_number, subject_name, subject_type, investigator_id, room, profile_id, created_at, started_at, ended_at, duration_ms, size_bytes)
       SELECT $1, 'INCOMPLETE', 'LP/2026/1010-9001', 'Test Saksi', 'SAKSI', (SELECT id FROM public.operators ORDER BY id LIMIT 1), 'Interview Room 1', 'STANDARD_1080P25', 1791600000000, 1791600001000, 1791600005000, 4000, 0`,
      [PRODUCTION],
    );
    expect((await facts()).unsealedSessions).toEqual([MIXED]);
  });
});
