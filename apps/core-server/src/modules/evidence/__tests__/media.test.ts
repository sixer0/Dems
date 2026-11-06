// The media reference of an evidence item (plan row W35; spec §11 MS-1 to MS-3, §8.5 ENG-18;
// SR-66; contract `EvidenceMediaRef`). Pure: no app, no database.
import { DEMO_PACKAGE_SUFFIX_PATTERN, EvidenceMediaRefSchema } from '@dems/shared/api';
import { demoIdSuffix, listDemoEvidencePackages } from '@dems/shared/demo-data';
import { IntegritySource, createIdleState, type EvidenceItem } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { mediaRefOf } from '../media';

const DAY_MS = 86_400_000;
const SEED_INSTANT = Date.UTC(2026, 9, 1, 3, 0, 0);
const datasetAt = (now: number): EvidenceItem[] => createIdleState({ now, seed: 20_261_001 }).evidence;

describe('the media reference of the dataset items', () => {
  it.each([
    ['the instant the packages are frozen at', SEED_INSTANT],
    ['45 days later', SEED_INSTANT + 45 * DAY_MS],
    ['a year later', SEED_INSTANT + 365 * DAY_MS],
  ])('all 13 join their bundled package on %s: the dated parts of the IDs do not matter (ENG-18)', (_label, now) => {
    const items = datasetAt(now);
    expect(items).toHaveLength(13);
    for (const item of items) {
      const reference = mediaRefOf(item);
      expect(reference, item.id).toEqual({ source: 'DEMO_PACKAGE', packageSuffix: item.id.slice(-4) });
      // The suffix is the four digits `demoIdSuffix` reads from the evidence ID.
      expect(reference.packageSuffix).toBe(demoIdSuffix(item.id, 'EV'));
      expect(EvidenceMediaRefSchema.safeParse(reference).success).toBe(true);
      // The item itself says the same: its sealed hashes are the package's.
      expect(item.integritySource).toBe(IntegritySource.DEMO_PACKAGE);
    }
    expect(new Set(items.map((item) => mediaRefOf(item).packageSuffix)).size).toBe(13);
  });
});

describe('an item that joins no package answers NONE', () => {
  const [first] = datasetAt(SEED_INSTANT);
  if (first === undefined) throw new Error('the dataset has evidence');

  it('each of the four parts of the join must match: suffix of the evidence ID, suffix of the session ID, case sequence, subject', () => {
    const none = { source: 'NONE', packageSuffix: null };
    expect(mediaRefOf(first).source).toBe('DEMO_PACKAGE');
    expect(mediaRefOf({ ...first, subjectName: 'Somebody Else' })).toEqual(none);
    expect(mediaRefOf({ ...first, caseNumber: 'LP/2026/1001-0999' })).toEqual(none);
    expect(mediaRefOf({ ...first, sessionId: 'SES-20261001-0999' })).toEqual(none);
    expect(mediaRefOf({ ...first, id: 'EV-20261001-0999' })).toEqual(none);
    expect(EvidenceMediaRefSchema.safeParse(mediaRefOf({ ...first, subjectName: 'Somebody Else' })).success).toBe(true);
  });

  it('a session recorded live seals into an evidence number a package uses, and still joins nothing', () => {
    // 0014 is the package of the recording scenario; another case and subject are another interview.
    const live = { id: 'EV-20261001-0014', sessionId: 'SES-20261001-0024', caseNumber: 'LP/2026/1001-0099', subjectName: 'Test Subject' };
    expect(listDemoEvidencePackages().some((entry) => entry.evidenceSuffix === '0014')).toBe(true);
    expect(mediaRefOf(live)).toEqual({ source: 'NONE', packageSuffix: null });
  });

  it('the dated parts alone change nothing; white space around the subject is ignored by the shared join', () => {
    expect(mediaRefOf({ ...first, id: `EV-20270101-${first.id.slice(-4)}`, sessionId: `SES-20270101-${first.sessionId.slice(-4)}` }).source).toBe('DEMO_PACKAGE');
    expect(mediaRefOf({ ...first, subjectName: `  ${first.subjectName} ` }).source).toBe('DEMO_PACKAGE');
  });
});

describe('SR-66, MS-3: a reference, never a file', () => {
  it('holds exactly two members: a source, and four digits or null. No path, no URL, no file name', () => {
    for (const item of datasetAt(SEED_INSTANT)) {
      const reference = mediaRefOf(item);
      expect(Object.keys(reference).sort()).toEqual(['packageSuffix', 'source']);
      expect(reference.packageSuffix).toMatch(DEMO_PACKAGE_SUFFIX_PATTERN);
      expect(JSON.stringify(reference)).not.toMatch(/[\\/]|\.\.|\.mp4|\.wav|\.json|https?:|file:|assets|demo-evidence/i);
    }
  });

  it('the contract refuses a reference whose source and suffix do not go together, and anything that names a file', () => {
    expect(EvidenceMediaRefSchema.safeParse({ source: 'DEMO_PACKAGE', packageSuffix: null }).success).toBe(false);
    expect(EvidenceMediaRefSchema.safeParse({ source: 'NONE', packageSuffix: '0004' }).success).toBe(false);
    expect(EvidenceMediaRefSchema.safeParse({ source: 'DEMO_PACKAGE', packageSuffix: '../0004' }).success).toBe(false);
    expect(EvidenceMediaRefSchema.safeParse({ source: 'DEMO_PACKAGE', packageSuffix: '0004', path: 'demo-evidence/0004' }).success).toBe(false);
  });

  it('the answer for NONE is one frozen object: a caller cannot change what the next caller gets', () => {
    const none = mediaRefOf({ id: 'EV-20261001-0999', sessionId: 'SES-20261001-0999', caseNumber: 'LP/2026/1001-0999', subjectName: 'Nobody' });
    expect(Object.isFrozen(none)).toBe(true);
    expect(mediaRefOf({ id: 'EV-20261001-0998', sessionId: 'SES-20261001-0998', caseNumber: 'LP/2026/1001-0998', subjectName: 'Nobody' })).toBe(none);
  });
});
