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
  evaluateRealEvidence,
  findRealSealedEvidence,
  realEvidenceDetails,
  realEvidenceMessage,
  type RealEvidenceQueryable,
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
