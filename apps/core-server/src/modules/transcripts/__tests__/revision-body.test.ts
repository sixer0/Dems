// The canonical body of a transcript revision and the two pure rules of the routes (integration
// pass D4). No database, no file, no key.
import type { TranscriptRevisionRecord } from '@dems/shared/evidence-verify';
import { describe, expect, it } from 'vitest';
import { changesOfStoredBody, pageOfRevisions, reconciled, revisionBodyOf, revisionDigestOf, revisionIdOf, storableReasonOf, type RevisionBodyInput } from '../index';

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const INPUT: RevisionBodyInput = {
  evidenceId: 'EV-20261009-0001',
  baseRevision: 0,
  parentSha256: 'aa'.repeat(32),
  machineTranscriptSha256: 'aa'.repeat(32),
  authorId: 'OPR-001',
  reason: 'The witness said Bu, not Pak.',
  createdAt: 1_790_823_600_000,
  changes: [{ segmentIndex: 1, from: 'Pak', to: 'Bu' }],
};

describe('the body: everything a reader is shown is inside the hash', () => {
  it('the number follows the base; the digest is 32 bytes and does not depend on the order the members were given in', () => {
    const body = revisionBodyOf(INPUT);
    expect(body).toMatchObject({ schema: 'dems.transcript-revision/1', revisionNo: 1, baseRevision: 0 });
    const digest = revisionDigestOf(body);
    expect(digest).toHaveLength(32);
    const reordered = Object.fromEntries(Object.entries(body).reverse()) as unknown as typeof body;
    expect(hex(revisionDigestOf(reordered))).toBe(hex(digest));
  });

  it.each([
    ['the author', { authorId: 'OPR-002' }],
    ['the reason', { reason: 'Another reason entirely.' }],
    ['the time', { createdAt: 1_790_823_600_001 }],
    ['a corrected text', { changes: [{ segmentIndex: 1, from: 'Pak', to: 'Ibu' }] }],
    ['the segment', { changes: [{ segmentIndex: 0, from: 'Pak', to: 'Bu' }] }],
    ['the parent', { parentSha256: 'bb'.repeat(32) }],
    ['the machine transcript', { machineTranscriptSha256: 'bb'.repeat(32) }],
    ['the item', { evidenceId: 'EV-20261009-0002' }],
    ['the base', { baseRevision: 1 }],
  ])('%s changes the digest', (_name, change) => {
    expect(hex(revisionDigestOf(revisionBodyOf({ ...INPUT, ...change })))).not.toBe(hex(revisionDigestOf(revisionBodyOf(INPUT))));
  });

  it('the body is a copy: a later edit of the request does not reach it', () => {
    const changes = [{ segmentIndex: 1, from: 'Pak', to: 'Bu' }];
    const body = revisionBodyOf({ ...INPUT, changes });
    (changes[0] as { to: string }).to = 'edited';
    expect(body.changes[0]?.to).toBe('Bu');
    expect(Object.isFrozen(body) && Object.isFrozen(body.changes)).toBe(true);
  });

  it('the revision ID and the stored reason: the author\'s own words of 5 to 500 characters, or nothing', () => {
    expect([revisionIdOf(1), revisionIdOf(42), revisionIdOf(1_234_567)]).toEqual(['TRV-000001', 'TRV-000042', 'TRV-1234567']);
    expect(storableReasonOf('  A fair reason.  ')).toBe('A fair reason.');
    expect([storableReasonOf(undefined), storableReasonOf(''), storableReasonOf('abcd'), storableReasonOf('   ab   '), storableReasonOf('x'.repeat(501))]).toEqual([null, null, null, null, null]);
    expect(storableReasonOf('x'.repeat(500))).toHaveLength(500);
  });
});

describe('a body read back from a package record', () => {
  const body = revisionBodyOf(INPUT);
  const sha256 = hex(revisionDigestOf(body));
  const expected = { evidenceId: INPUT.evidenceId, revisionNo: 1, sha256 };
  const stored = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;

  it('its changes are answered when its hash is the stored hash', () => {
    expect(changesOfStoredBody(stored, expected)).toEqual([{ segmentIndex: 1, from: 'Pak', to: 'Bu' }]);
  });

  it('not when it was altered, is another revision\'s, another item\'s, another schema\'s, or is absent', () => {
    expect(changesOfStoredBody({ ...stored, reason: 'altered' }, expected)).toBeNull();
    expect(changesOfStoredBody({ ...stored, changes: [{ segmentIndex: 1, from: 'Pak', to: 'altered' }] }, expected)).toBeNull();
    expect(changesOfStoredBody(stored, { ...expected, revisionNo: 2 })).toBeNull();
    expect(changesOfStoredBody(stored, { ...expected, evidenceId: 'EV-20261009-0002' })).toBeNull();
    expect(changesOfStoredBody({ ...stored, schema: 'other/1' }, expected)).toBeNull();
    expect([changesOfStoredBody(undefined, expected), changesOfStoredBody(null, expected), changesOfStoredBody('text', expected)]).toEqual([null, null, null]);
  });
});

describe('the package list against the stored chain', () => {
  const record = (revisionNo: number, sha256: string): TranscriptRevisionRecord => ({ revisionNo, parentSha256: 'aa'.repeat(32), sha256, authorId: 'OPR-001', reason: 'A reason.', createdAt: 1, signature: { algorithm: 'Ed25519', keyId: 'K', value: 'ab', certificateSha256: null } });
  const A = '0a'.repeat(32);
  const B = '0b'.repeat(32);

  it('one record per stored row, in order, with the row\'s hash; records after the last row are dropped', () => {
    expect(reconciled([], [])).toEqual([]);
    expect(reconciled([record(1, A), record(2, B)], [{ revisionNo: 1, sha256: A }, { revisionNo: 2, sha256: B }])?.map((kept) => kept.revisionNo)).toEqual([1, 2]);
    // The remains of an append whose unit did not commit.
    expect(reconciled([record(1, A), record(2, B)], [{ revisionNo: 1, sha256: A }])?.map((kept) => kept.revisionNo)).toEqual([1]);
    expect(reconciled([record(1, A)], [])).toEqual([]);
  });

  it('a missing record, another hash or another number is no list of this chain', () => {
    expect(reconciled([], [{ revisionNo: 1, sha256: A }])).toBeNull();
    expect(reconciled([record(1, B)], [{ revisionNo: 1, sha256: A }])).toBeNull();
    expect(reconciled([record(2, A)], [{ revisionNo: 1, sha256: A }])).toBeNull();
    expect(reconciled([record(1, A)], [{ revisionNo: 1, sha256: A }, { revisionNo: 2, sha256: B }])).toBeNull();
  });
});

describe('the page of operation 86', () => {
  const item = (number: number) => ({ revisionId: revisionIdOf(number), number, authorId: 'OPR-001', baseRevision: number - 1, machineTranscriptHash: 'aa'.repeat(32), signedBy: 'K', signature: { value: 'ab'.repeat(64), keyId: 'K', algorithm: 'Ed25519' as const, simulated: false }, createdAt: 1, changes: [] });
  const five = [5, 4, 3, 2, 1].map(item);

  it('walks to the end without a repeat; the cursor is the number of the last item', () => {
    const first = pageOfRevisions(five, null, 2);
    expect([first.items.map((entry) => entry.number), first.nextCursor]).toEqual([[5, 4], '4']);
    const second = pageOfRevisions(five, 4, 2);
    expect([second.items.map((entry) => entry.number), second.nextCursor]).toEqual([[3, 2], '2']);
    const third = pageOfRevisions(five, 2, 2);
    expect([third.items.map((entry) => entry.number), third.nextCursor]).toEqual([[1], null]);
    expect(pageOfRevisions(five, null, 5).nextCursor).toBeNull();
  });
});
