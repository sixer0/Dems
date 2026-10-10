// The real-evidence guard of R-0, without a database and without a disk (blueprint row 54 / CS-21;
// `dbc-3` §E.2; OD-19, RK-16, SEC35-22). The comparison of the two sides is pure, so every case is
// given the rows it would ask for and the store scan it would read.
import { describe, expect, it } from 'vitest';
import type { EvidenceStoreScan } from '../../commands/evidence-store';
import { ResetError } from '../errors';
import {
  MAX_NAMED_SESSIONS,
  REAL_SEALED_EVIDENCE_STATEMENT,
  assertNoRealSealedEvidence,
  clearedDevelopmentPackages,
  developmentPackagesMessage,
  evaluateRealEvidence,
  findRealSealedEvidence,
  realEvidenceDetails,
  realEvidenceMessage,
  type RealEvidenceQueryable,
  type SealedSourceMarkReader,
} from '../real-evidence';

const scan = (present: boolean, packages: EvidenceStoreScan['packages'] = []): EvidenceStoreScan => ({ root: '/store', present, packages });
const pkg = (sessionId: string, integrity: 'REAL' | 'DEMO' | 'UNKNOWN') => ({ sessionId, directory: `SESSION-${sessionId}`, integrity });

describe('the database question', () => {
  it('is the SELECT of dbc-3 §E.2: REAL and sealed, nothing else', () => {
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain("e.integrity_source = 'REAL'");
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('e.sealed_at IS NOT NULL');
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toMatch(/^SELECT\b/);
    expect(REAL_SEALED_EVIDENCE_STATEMENT).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE|DROP)\b/);
  });
});

describe('evaluateRealEvidence: both sides, fail-safe', () => {
  it('a demo-only database and an empty store never block', () => {
    const facts = evaluateRealEvidence('dems_demo', '/store', [], scan(true, [pkg('S1', 'DEMO'), pkg('S2', 'DEMO')]));
    expect(facts.blocked).toBe(false);
    expect(facts.dbSessions).toEqual([]);
    expect(facts.diskSessions).toEqual([]);
  });

  it('a REAL sealed row whose package is gone blocks (a half-deleted set)', () => {
    const facts = evaluateRealEvidence('dems_demo', '/store', ['SESSION-A'], scan(false));
    expect(facts.blocked).toBe(true);
    expect(facts.missingOnDisk).toEqual(['SESSION-A']);
    expect(facts.missingInDatabase).toEqual([]);
  });

  it('a REAL package no row names blocks (the other half of the same defect)', () => {
    const facts = evaluateRealEvidence('dems_demo', '/store', [], scan(true, [pkg('SESSION-B', 'REAL')]));
    expect(facts.blocked).toBe(true);
    expect(facts.missingInDatabase).toEqual(['SESSION-B']);
    expect(facts.missingOnDisk).toEqual([]);
  });

  it('both sides agreeing on one REAL sealed session still blocks', () => {
    const facts = evaluateRealEvidence('dems_demo', '/store', ['SESSION-C'], scan(true, [pkg('SESSION-C', 'REAL')]));
    expect(facts.blocked).toBe(true);
    expect(facts.missingOnDisk).toEqual([]);
    expect(facts.missingInDatabase).toEqual([]);
  });

  it('a package whose integrity cannot be read cannot be cleared either', () => {
    const facts = evaluateRealEvidence('dems_demo', '/store', [], scan(true, [pkg('SESSION-D', 'UNKNOWN')]));
    expect(facts.blocked).toBe(true);
    expect(facts.unprovablePackages).toEqual(['SESSION-SESSION-D']);
  });

  it('the database sessions are sorted, so the halves are stable regardless of row order', () => {
    const facts = evaluateRealEvidence('dems_demo', '/store', ['S9', 'S1', 'S5'], scan(false));
    expect(facts.dbSessions).toEqual(['S1', 'S5', 'S9']);
  });
});

describe('the refusal message and its log details', () => {
  const facts = evaluateRealEvidence('dems_lane_2', '/store', ['SESSION-A'], scan(true, [pkg('SESSION-B', 'REAL')]));

  it('names the code, both sides, the two halves, and says nothing was changed', () => {
    const message = realEvidenceMessage(facts);
    expect(message).toContain('RESET_BLOCKED_REAL_EVIDENCE');
    expect(message).toContain('dems_lane_2');
    expect(message).toContain('/store');
    expect(message).toContain('1 REAL sealed item(s)');
    expect(message).toContain('1 REAL package(s)');
    expect(message).toContain('in the database without a package: SESSION-A');
    expect(message).toContain('on disk without a database row: SESSION-B');
    expect(message).toContain('Nothing was changed.');
  });

  it('counts the identifiers it does not name instead of listing them all', () => {
    const many = Array.from({ length: MAX_NAMED_SESSIONS + 3 }, (_, index) => `SESSION-${String(index)}`);
    const message = realEvidenceMessage(evaluateRealEvidence('dems_demo', '/store', many, scan(false)));
    expect(message).toContain(`and ${MAX_NAMED_SESSIONS + 3 - MAX_NAMED_SESSIONS} more`);
  });

  it('the log details hold counts and names only, never a value', () => {
    expect(realEvidenceDetails(facts)).toEqual({
      database: 'dems_lane_2',
      storeRoot: '/store',
      storePresent: true,
      realRows: 1,
      // Fix pass F-M7 (R88-09): sessions that recorded and are not sealed, and quarantined folders; `storeUnreadable` only when the store could not be listed.
      unsealedSessions: 0,
      quarantinedFolders: 0,
      // dbc-4 §N.10 (row 129): the two counts of the development-package exemption.
      developmentUnproven: 0,
      developmentPackages: 0,
      realPackages: 1,
      unreadablePackages: 0,
      rowsWithoutPackage: 1,
      packagesWithoutRow: 1,
    });
  });
});

describe('findRealSealedEvidence and the guard itself', () => {
  const clientReturning = (sessionIds: readonly string[]): RealEvidenceQueryable =>
    ({ query: async () => ({ rows: sessionIds.map((session_id) => ({ session_id })) }) }) as unknown as RealEvidenceQueryable;

  it('asks the client the fixed question and reads the store once', async () => {
    let asked = '';
    let readRoot = '';
    const client = {
      query: async (text: string) => {
        asked = text;
        return { rows: [{ session_id: 'SESSION-A' }] };
      },
    } as unknown as RealEvidenceQueryable;
    const facts = await findRealSealedEvidence(client, {
      database: 'dems_demo',
      storeRoot: '/store',
      readStore: (root) => {
        readRoot = root;
        return scan(true, [pkg('SESSION-A', 'REAL')]);
      },
    });
    expect(asked).toBe(REAL_SEALED_EVIDENCE_STATEMENT);
    expect(readRoot).toBe('/store');
    expect(facts.blocked).toBe(true);
  });

  it('resolves with the facts when a reset may go on', async () => {
    const facts = await assertNoRealSealedEvidence(clientReturning([]), {
      database: 'dems_demo',
      storeRoot: '/store',
      readStore: () => scan(true, [pkg('S1', 'DEMO')]),
    });
    expect(facts.blocked).toBe(false);
  });

  it('throws RESET_BLOCKED_REAL_EVIDENCE at R-0 with the target untouched', async () => {
    const error = await assertNoRealSealedEvidence(clientReturning(['SESSION-A']), {
      database: 'dems_demo',
      storeRoot: '/store',
      readStore: () => scan(false),
    }).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ResetError);
    expect(error).toMatchObject({ code: 'RESET_BLOCKED_REAL_EVIDENCE', step: 'R-0', targetUntouched: true });
    expect((error as ResetError).message).toContain('RESET_BLOCKED_REAL_EVIDENCE');
  });
});

// ── D98(1): the disk side follows the row side (blueprint row 141) ────────────────────────────────

describe('clearedDevelopmentPackages: which folders a signed development mark clears', () => {
  const DIGEST = 'ab'.repeat(32);
  const item = (sessionId: string, over: Partial<{ evidenceId: string | null; manifestSha256: string | null }> = {}) => ({ sessionId, evidenceId: `EV-${sessionId}`, manifestSha256: DIGEST, ...over });
  const development: SealedSourceMarkReader = async () => ({ signed: true, development: true });

  it('asks the reader for the folder of an exempt item only, with the anchors of its row, and clears it for signed AND development', async () => {
    const asked: { dir: string; anchors: unknown }[] = [];
    const cleared = await clearedDevelopmentPackages(
      '/store',
      scan(true, [pkg('S-DEV', 'UNKNOWN'), pkg('S-DEV-REAL', 'REAL'), pkg('S-DEMO', 'DEMO'), pkg('S-STRAY', 'UNKNOWN'), pkg('S-BLOCKING', 'REAL')]),
      { blocking: ['S-BLOCKING'], developmentItems: [item('S-DEV'), item('S-DEV-REAL'), item('S-DEMO'), item('S-BLOCKING')] },
      async (dir, anchors) => {
        asked.push({ dir, anchors });
        return { signed: true, development: true };
      },
    );
    expect(cleared).toEqual(['SESSION-S-DEV', 'SESSION-S-DEV-REAL']);
    // A demo folder never blocks and is not asked; a folder no exempt row names and one a blocking row names are not asked either.
    expect(asked).toEqual([
      { dir: '/store/SESSION-S-DEV', anchors: { sessionId: 'S-DEV', evidenceId: 'EV-S-DEV', manifestSha256: DIGEST } },
      { dir: '/store/SESSION-S-DEV-REAL', anchors: { sessionId: 'S-DEV-REAL', evidenceId: 'EV-S-DEV-REAL', manifestSha256: DIGEST } },
    ]);
  });

  it('clears nothing for: not signed, signed and not development, a reader that rejects, a truthy value that is not true', async () => {
    const one = scan(true, [pkg('S-DEV', 'UNKNOWN')]);
    const split = { blocking: [], developmentItems: [item('S-DEV')] };
    expect(await clearedDevelopmentPackages('/store', one, split, development)).toEqual(['SESSION-S-DEV']);
    expect(await clearedDevelopmentPackages('/store', one, split, async () => ({ signed: false, development: true }))).toEqual([]);
    expect(await clearedDevelopmentPackages('/store', one, split, async () => ({ signed: true, development: false }))).toEqual([]);
    expect(await clearedDevelopmentPackages('/store', one, split, async () => Promise.reject(new Error('unreadable')))).toEqual([]);
    expect(await clearedDevelopmentPackages('/store', one, split, async () => ({ signed: 1, development: 'yes' }) as unknown as { signed: boolean; development: boolean })).toEqual([]);
  });

  it('clears nothing without the anchors: no item ID, no digest, a digest that is not 64 hex, two exempt rows of one session, a folder without a session', async () => {
    const one = scan(true, [pkg('S-DEV', 'UNKNOWN')]);
    const with_ = (items: ReturnType<typeof item>[]) => clearedDevelopmentPackages('/store', one, { blocking: [], developmentItems: items }, development);
    expect(await with_([item('S-DEV', { evidenceId: null })])).toEqual([]);
    expect(await with_([item('S-DEV', { manifestSha256: null })])).toEqual([]);
    expect(await with_([item('S-DEV', { manifestSha256: 'AB'.repeat(32) })])).toEqual([]);
    expect(await with_([item('S-DEV'), item('S-DEV')])).toEqual([]);
    expect(await with_([])).toEqual([]);
    const nameless = scan(true, [{ sessionId: '', directory: 'SESSION-', integrity: 'UNKNOWN' }]);
    expect(await clearedDevelopmentPackages('/store', nameless, { blocking: [], developmentItems: [item('')] }, development)).toEqual([]);
  });

  it('a cleared folder is in none of the blocking lists; every other folder still counts', () => {
    const packages = scan(true, [pkg('S-DEV', 'UNKNOWN'), pkg('S-OTHER', 'UNKNOWN'), pkg('S-REAL', 'REAL')]);
    const facts = evaluateRealEvidence('dems_lane_2', '/store', [], packages, { development: ['S-DEV'], clearedOnDisk: ['SESSION-S-DEV'] });
    expect(facts).toMatchObject({ blocked: true, developmentPackagesOnDisk: ['SESSION-S-DEV'], unprovablePackages: ['SESSION-S-OTHER'], diskSessions: ['S-REAL'] });
    const alone = evaluateRealEvidence('dems_lane_2', '/store', [], scan(true, [pkg('S-DEV', 'UNKNOWN')]), { development: ['S-DEV'], clearedOnDisk: ['SESSION-S-DEV'] });
    expect(alone.blocked).toBe(false);
    expect(developmentPackagesMessage(alone)).toContain('1 package folder(s) on disk carry the signed development mark');
    // Without the cleared list the same folder blocks (the rule before row 141, and the default).
    expect(evaluateRealEvidence('dems_lane_2', '/store', [], scan(true, [pkg('S-DEV', 'UNKNOWN')]), { development: ['S-DEV'] }).blocked).toBe(true);
  });

  it('findRealSealedEvidence hands the row\'s anchors to the reader and leaves a non-exempt row\'s folder alone', async () => {
    const rows = [
      { session_id: 'S-DEV', evidence_id: 'EV-1', manifest_hash: DIGEST, development_flag: true, source_rows: 4, development_rows: 4 },
      { session_id: 'S-FLAG-ONLY', evidence_id: 'EV-2', manifest_hash: DIGEST, development_flag: true, source_rows: 4, development_rows: 3 },
    ];
    const asked: string[] = [];
    const facts = await findRealSealedEvidence({ query: async () => ({ rows }) } as unknown as RealEvidenceQueryable, {
      database: 'dems_demo',
      storeRoot: '/store',
      readStore: () => scan(true, [pkg('S-DEV', 'UNKNOWN'), pkg('S-FLAG-ONLY', 'UNKNOWN')]),
      readSourceMark: async (dir) => {
        asked.push(dir);
        return { signed: true, development: true };
      },
    });
    expect(asked).toEqual(['/store/SESSION-S-DEV']);
    expect(facts).toMatchObject({ blocked: true, dbSessions: ['S-FLAG-ONLY'], developmentSessions: ['S-DEV'], developmentPackagesOnDisk: ['SESSION-S-DEV'], unprovablePackages: ['SESSION-S-FLAG-ONLY'] });
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('e.id::text AS evidence_id, e.manifest_hash::text AS manifest_hash');
  });
});

// Integration pass E3 item 6 (c): the demo packages a seed SEALED into the store are held to the
// rules of a development item - the flag, the four development source rows, the signed mark of
// the folder - and to nothing looser. Their rows never block; their folders block unless cleared.
describe('PASS E3: seed-sealed demo packages are exempt exactly like development items', () => {
  const HASH = 'ab'.repeat(32);
  const demo = (sessionId: string, more: Record<string, unknown> = {}) => ({ session_id: sessionId, evidence_id: `EV-${sessionId}`, manifest_hash: HASH, integrity_source: 'DEMO_PACKAGE', development_flag: true, source_rows: 4, development_rows: 4, ...more });
  const run = (rows: readonly Record<string, unknown>[], packages: EvidenceStoreScan['packages'], signed: (dir: string) => boolean = () => true) => {
    const asked: { dir: string; anchors: unknown }[] = [];
    return findRealSealedEvidence({ query: async () => ({ rows }) } as unknown as RealEvidenceQueryable, {
      database: 'dems_demo',
      storeRoot: '/store',
      readStore: () => scan(true, packages),
      readSourceMark: async (dir, anchors) => {
        asked.push({ dir, anchors });
        return { signed: signed(dir), development: signed(dir) };
      },
    }).then((facts) => ({ facts, asked }));
  };

  it('the statement also reads DEMO_PACKAGE rows of version 2 whose signature is not the stand-in, with their integrity source', () => {
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain("e.integrity_source = 'DEMO_PACKAGE' AND e.manifest_version = 2 AND e.signature_simulated IS FALSE");
    expect(REAL_SEALED_EVIDENCE_STATEMENT).toContain('e.integrity_source::text AS integrity_source');
  });

  it('PERMITTED: the row passes both rules and its folder carries the signed development mark of that item - not blocked, counted apart, cleared for removal', async () => {
    const { facts, asked } = await run([demo('S-DEMO')], [pkg('S-DEMO', 'UNKNOWN')]);
    expect(facts).toMatchObject({ blocked: false, dbSessions: [], developmentSessions: [], seedSealedDemoSessions: ['S-DEMO'], developmentPackagesOnDisk: ['SESSION-S-DEMO'], unprovablePackages: [] });
    // The folder was held to the item's own anchors: the session, the item and the digest of its row.
    expect(asked).toEqual([{ dir: '/store/SESSION-S-DEMO', anchors: { sessionId: 'S-DEMO', evidenceId: 'EV-S-DEMO', manifestSha256: HASH } }]);
    expect(developmentPackagesMessage(facts)).toMatch(/^this reset replaces 1 seed-sealed demo package record\(s\) of dems_demo \(S-DEMO\)/);
  });

  it('BLOCKED, each control: no development flag; fewer than four development source rows; a folder whose manifest is not the signed development one; a folder no such row names', async () => {
    for (const row of [demo('S-DEMO', { development_flag: false }), demo('S-DEMO', { development_flag: null }), demo('S-DEMO', { source_rows: 0, development_rows: 0 }), demo('S-DEMO', { development_rows: 3 })]) {
      const { facts, asked } = await run([row], [pkg('S-DEMO', 'UNKNOWN')]);
      // The ROW never blocks (a demo row is no real evidence) - the FOLDER does: it has no anchor, so it is never even asked.
      expect(facts).toMatchObject({ blocked: true, dbSessions: [], seedSealedDemoSessions: [], developmentPackagesOnDisk: [], unprovablePackages: ['SESSION-S-DEMO'] });
      expect(asked).toEqual([]);
    }
    const unsigned = await run([demo('S-DEMO')], [pkg('S-DEMO', 'UNKNOWN')], () => false);
    expect(unsigned.facts).toMatchObject({ blocked: true, unprovablePackages: ['SESSION-S-DEMO'], developmentPackagesOnDisk: [] });
    const orphan = await run([demo('S-DEMO')], [pkg('S-DEMO', 'UNKNOWN'), pkg('S-OTHER', 'UNKNOWN')]);
    expect(orphan.facts).toMatchObject({ blocked: true, unprovablePackages: ['SESSION-S-OTHER'], developmentPackagesOnDisk: ['SESSION-S-DEMO'] });
  });

  it('a REAL row is judged as before, beside a demo row: an unflagged REAL item blocks and is named; a row without the member reads as REAL', async () => {
    const { facts } = await run([demo('S-DEMO'), { session_id: 'S-REAL', evidence_id: 'EV-R', manifest_hash: HASH, integrity_source: 'REAL', development_flag: false, source_rows: 4, development_rows: 0 }, { session_id: 'S-OLD' }], [pkg('S-DEMO', 'UNKNOWN')]);
    expect(facts).toMatchObject({ blocked: true, dbSessions: ['S-OLD', 'S-REAL'], seedSealedDemoSessions: ['S-DEMO'] });
  });
});
