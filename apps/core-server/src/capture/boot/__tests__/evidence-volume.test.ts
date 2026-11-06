// The probe of the evidence store on a REAL volume (blueprint row 61; register CS-22, CS-09; D85
// R-5, D127 "row 61's storage check tests link()"). Real directories below the git-ignored `.data/`.
// NOT PROVEN HERE: a volume WITHOUT hard links (none can be made without a device call). The rule
// for it is proven on facts in `checks.test.ts` (`hardLink: false` -> NO_HARD_LINKS).
import { chmodSync, linkSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { EvidenceStoreProblem, evidenceStoreProblemOf } from '../checks';
import { probeEvidenceVolume } from '../evidence-volume';
import { realBootFixture } from './support';

const fixture = realBootFixture('volume');
afterAll(() => fixture.remove());

describe('probeEvidenceVolume', () => {
  it('a store that is not there is created private; the volume takes exclusive create, sync and a hard link; nothing is left behind', () => {
    const store = `${fixture.dataDir}/fresh/media/sessions`;
    const facts = probeEvidenceVolume(store);
    expect(facts).toMatchObject({ absolute: true, present: true, directory: true, exclusiveCreate: true, exclusiveRefusesSecond: true, synced: true, hardLink: true, linkRefusesExisting: true, cleaned: true });
    expect(facts.ownerUid).toBe(process.getuid?.());
    expect(evidenceStoreProblemOf(facts)).toBeNull();
    expect(statSync(store).mode & 0o777).toBe(0o700);
    expect(readdirSync(store)).toEqual([]);
    // CS-09: the figures are the volume's own, and what is free is no more than what is there.
    expect(facts.totalBytes).toBeGreaterThan(1_000_000_000);
    expect(facts.freeBytes).toBeGreaterThan(0);
    expect(facts.freeBytes).toBeLessThanOrEqual(facts.totalBytes ?? 0);
  });

  it('touches nothing that was there: a session folder and a camera file with two names keep their bytes, names and link count', () => {
    const store = `${fixture.dataDir}/used`;
    mkdirSync(`${store}/SES-20261009-0001`, { recursive: true, mode: 0o700 });
    const file = `${store}/SES-20261009-0001/VIDEO-01.mp4`;
    writeFileSync(file, 'bytes of evidence', { mode: 0o600 });
    linkSync(file, `${file}.123.part`);
    const before = statSync(file);
    expect(evidenceStoreProblemOf(probeEvidenceVolume(store))).toBeNull();
    expect(evidenceStoreProblemOf(probeEvidenceVolume(store))).toBeNull();
    const after = statSync(file);
    expect([after.size, after.nlink, after.mtimeMs, after.ino]).toEqual([before.size, 2, before.mtimeMs, before.ino]);
    expect(readdirSync(store)).toEqual(['SES-20261009-0001']);
    expect(readdirSync(`${store}/SES-20261009-0001`).sort()).toEqual(['VIDEO-01.mp4', 'VIDEO-01.mp4.123.part']);
  });

  it('a relative path is not probed at all', () => {
    expect(evidenceStoreProblemOf(probeEvidenceVolume('media/sessions'))).toBe(EvidenceStoreProblem.NOT_ABSOLUTE);
  });

  it('a file where the store should be: NOT_A_DIRECTORY, and the file is not touched', () => {
    const path = `${fixture.dataDir}/a-file`;
    writeFileSync(path, 'x');
    expect(evidenceStoreProblemOf(probeEvidenceVolume(path))).toBe(EvidenceStoreProblem.NOT_A_DIRECTORY);
    expect(statSync(path).size).toBe(1);
  });

  it('a store below a file cannot be created: NOT_CREATABLE', () => {
    expect(evidenceStoreProblemOf(probeEvidenceVolume(`${fixture.dataDir}/a-file/media`))).toBe(EvidenceStoreProblem.NOT_CREATABLE);
  });

  it('a store group or others can write is refused before anything is written in it', () => {
    const store = `${fixture.dataDir}/shared`;
    mkdirSync(store, { mode: 0o700 });
    chmodSync(store, 0o770);
    expect(evidenceStoreProblemOf(probeEvidenceVolume(store))).toBe(EvidenceStoreProblem.WRITABLE_BY_OTHERS);
    chmodSync(store, 0o700);
    expect(evidenceStoreProblemOf(probeEvidenceVolume(store))).toBeNull();
  });

  it('a store the server cannot write: NOT_WRITABLE (control: the same directory, writable again, passes)', () => {
    const store = `${fixture.dataDir}/read-only`;
    mkdirSync(store, { mode: 0o700 });
    chmodSync(store, 0o500);
    const facts = probeEvidenceVolume(store);
    expect(facts.exclusiveCreate).toBe(false);
    expect(evidenceStoreProblemOf(facts)).toBe(EvidenceStoreProblem.NOT_WRITABLE);
    chmodSync(store, 0o700);
    expect(evidenceStoreProblemOf(probeEvidenceVolume(store))).toBeNull();
  });
});
