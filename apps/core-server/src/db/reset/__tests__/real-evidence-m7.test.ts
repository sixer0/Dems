// Fix pass F-M7 (review row 88; decision D178), findings R88-09 and R88-11: the reset guard beside
// a real recording that is NOT sealed yet.
//
//   R88-09 (1)  a store root that cannot be LISTED is not an empty store: the reset is refused;
//   R88-09 (2)  the database side also blocks on a session that recorded from a production-class
//               source and is neither sealed nor terminally closed;
//   R88-09 (3)  a folder in `<root>/.quarantine/` is real evidence: it blocks;
//   R88-11      a v2 package folder is never read as DEMO from a planted `manifest.json`.
//
// Evidence integrity: one negative control per rule (the state next to it that must NOT block).
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readEvidenceStore, type EvidenceStoreScan } from '../../commands/evidence-store';
import { ResetError } from '../errors';
import { REAL_SEALED_EVIDENCE_STATEMENT, assertNoRealSealedEvidence, classifyRealSealedRows, evaluateRealEvidence, findRealSealedEvidence, realEvidenceDetails, realEvidenceMessage, type RealEvidenceQueryable } from '../real-evidence';

const roots: string[] = [];
afterAll(() => {
  // Children first (a root that was closed to the owner is opened again before its parent is removed).
  for (const dir of [...roots].reverse()) {
    try {
      chmodSync(dir, 0o700);
    } catch {
      // gone already, or no directory: nothing to open up
    }
  }
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});
const scratch = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'dems-fm7-reset-'));
  roots.push(dir);
  return dir;
};
const client = (rows: readonly Record<string, unknown>[]): RealEvidenceQueryable => ({ query: async () => ({ rows }) }) as unknown as RealEvidenceQueryable;
const emptyScan: EvidenceStoreScan = { root: '/store', present: true, packages: [] };

describe('R88-09 (1): a store root that cannot be listed REFUSES the reset', () => {
  it('a root that is there and is no listable directory: the scan says UNREADABLE with the cause, never "no store"', () => {
    const root = join(scratch(), 'sessions');
    writeFileSync(root, 'not a directory');
    const scan = readEvidenceStore(root);
    expect(scan).toMatchObject({ present: true, unreadable: 'ENOTDIR', packages: [] });
  });

  it('a root whose permissions forbid the listing: UNREADABLE (EACCES)', (context) => {
    if (process.getuid?.() === 0) return context.skip();
    const root = join(scratch(), 'sessions');
    mkdirSync(join(root, 'SESSION-SES-20261010-0001'), { recursive: true });
    chmodSync(root, 0o000);
    roots.push(root);
    expect(readEvidenceStore(root)).toMatchObject({ present: true, unreadable: 'EACCES', packages: [] });
  });

  it('THE HOLE OF R88-09: no sealed item in the database and an unlistable root - the guard throws RESET_BLOCKED_REAL_EVIDENCE and names the cause', async () => {
    const root = join(scratch(), 'sessions');
    writeFileSync(root, 'not a directory');
    const error = await assertNoRealSealedEvidence(client([]), { database: 'dems_demo', storeRoot: root }).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ResetError);
    expect(error).toMatchObject({ code: 'RESET_BLOCKED_REAL_EVIDENCE', step: 'R-0', targetUntouched: true });
    expect((error as ResetError).message).toContain('RESET_STORE_UNREADABLE');
    expect((error as ResetError).message).toContain('ENOTDIR');
  });

  it('CONTROL: a root that does not exist (ENOENT) is still "no store" and, with an empty database, does not block', async () => {
    const root = join(scratch(), 'never-made');
    expect(readEvidenceStore(root)).toMatchObject({ present: false, unreadable: null, packages: [], quarantined: [] });
    const facts = await assertNoRealSealedEvidence(client([]), { database: 'dems_demo', storeRoot: root });
    expect(facts).toMatchObject({ blocked: false, storeUnreadable: null });
  });

  it('the facts and the log details carry the cause', () => {
    const facts = evaluateRealEvidence('dems_demo', '/store', [], { ...emptyScan, unreadable: 'EIO' });
    expect(facts).toMatchObject({ blocked: true, storeUnreadable: 'EIO' });
    expect(realEvidenceDetails(facts)).toMatchObject({ storeUnreadable: 'EIO' });
    expect(realEvidenceMessage(facts)).toContain('could not be listed (RESET_STORE_UNREADABLE, EIO)');
    // Control: a listable store says nothing of it.
    expect(realEvidenceMessage(evaluateRealEvidence('dems_demo', '/store', ['S1'], emptyScan))).not.toContain('RESET_STORE_UNREADABLE');
  });
});

describe('R88-09 (2): a session that recorded from a production source and is not sealed blocks on the DATABASE side', () => {
  it('the one statement also asks for unsealed recorded sessions: production-class source rows, no sealed item, no history entry - a SELECT, on one snapshot', () => {
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('UNION ALL');
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain("'UNSEALED_RECORDING'");
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('FROM public.session_capture_sources');
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('NOT EXISTS (SELECT 1 FROM public.evidence_items');
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('NOT EXISTS (SELECT 1 FROM public.session_history');
    // FAIL CLOSED: the production class is "not a development kind", so a kind added later blocks.
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain("NOT IN ('FAKE', 'LOCAL_DEVICE')");
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toMatch(/^SELECT\b/);
    expect(REAL_SEALED_EVIDENCE_STATEMENT).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE|DROP)\b/);
  });

  it('such a row blocks, is counted apart and is named; it is never exempt, whatever flags it carries', async () => {
    const row = { session_id: 'SES-20261010-0007', evidence_id: null, manifest_hash: null, integrity_source: 'UNSEALED_RECORDING', development_flag: true, source_rows: 4, development_rows: 4 };
    const split = classifyRealSealedRows([row]);
    expect(split).toMatchObject({ blocking: ['SES-20261010-0007'], unsealed: ['SES-20261010-0007'], development: [], developmentItems: [] });
    // With a store that holds nothing of it (the folder is on a volume that is not mounted, or was moved).
    const facts = await findRealSealedEvidence(client([row]), { database: 'dems_demo', storeRoot: '/store', readStore: () => emptyScan });
    expect(facts).toMatchObject({ blocked: true, unsealedSessions: ['SES-20261010-0007'] });
    expect(realEvidenceMessage(facts)).toContain('1 session(s) that recorded from a production source and are not sealed (SES-20261010-0007)');
    expect(realEvidenceDetails(facts)).toMatchObject({ unsealedSessions: 1 });
  });

  it('CONTROL: without such a row the same store and database do not block', async () => {
    const facts = await findRealSealedEvidence(client([]), { database: 'dems_demo', storeRoot: '/store', readStore: () => emptyScan });
    expect(facts).toMatchObject({ blocked: false, unsealedSessions: [] });
  });
});

describe('R88-09 (3): the quarantine folder is real evidence', () => {
  it('a folder of a session in `<root>/.quarantine/` blocks the reset and is named', async () => {
    const root = join(scratch(), 'sessions');
    mkdirSync(join(root, '.quarantine', 'SES-20261010-0009'), { recursive: true });
    writeFileSync(join(root, '.quarantine', 'SES-20261010-0009', 'VIDEO-01.mp4'), 'plaintext recording');
    expect(readEvidenceStore(root)).toMatchObject({ present: true, unreadable: null, quarantined: ['SES-20261010-0009'] });
    const error = await assertNoRealSealedEvidence(client([]), { database: 'dems_demo', storeRoot: root }).catch((thrown: unknown) => thrown);
    expect(error).toMatchObject({ code: 'RESET_BLOCKED_REAL_EVIDENCE' });
    expect((error as ResetError).message).toContain('1 quarantined recording folder(s) [SES-20261010-0009]');
  });

  it('CONTROL: an empty quarantine folder, or none, does not block', async () => {
    const root = join(scratch(), 'sessions');
    mkdirSync(join(root, '.quarantine'), { recursive: true });
    expect((await assertNoRealSealedEvidence(client([]), { database: 'dems_demo', storeRoot: root })).blocked).toBe(false);
    const bare = join(scratch(), 'sessions');
    mkdirSync(bare);
    expect((await assertNoRealSealedEvidence(client([]), { database: 'dems_demo', storeRoot: bare })).blocked).toBe(false);
  });

  it('a quarantine that is there and cannot be listed is an unreadable store', () => {
    const root = join(scratch(), 'sessions');
    mkdirSync(root);
    writeFileSync(join(root, '.quarantine'), 'not a directory');
    expect(readEvidenceStore(root)).toMatchObject({ unreadable: 'ENOTDIR' });
  });
});

describe('R88-11: a v2 package folder is never cleared by a planted `manifest.json`', () => {
  it('a folder that holds `session-manifest.json` and a `manifest.json` saying DEMO_PACKAGE reads UNKNOWN (it blocks unless its SIGNED manifest clears it)', () => {
    const root = join(scratch(), 'sessions');
    const dir = join(root, 'SESSION-SES-20261010-0011');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'session-manifest.json'), '{}');
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ integrity: 'DEMO_PACKAGE' }));
    expect(readEvidenceStore(root).packages).toEqual([{ sessionId: 'SES-20261010-0011', directory: 'SESSION-SES-20261010-0011', integrity: 'UNKNOWN' }]);
  });

  it('CONTROL: a v1 demo folder (only `manifest.json`) still reads DEMO', () => {
    const root = join(scratch(), 'sessions');
    const dir = join(root, 'SESSION-SES-20261010-0012');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ integrity: 'DEMO_PACKAGE' }));
    expect(readEvidenceStore(root).packages[0]?.integrity).toBe('DEMO');
  });
});
