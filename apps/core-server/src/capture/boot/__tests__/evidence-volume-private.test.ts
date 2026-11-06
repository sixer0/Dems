// Fix pass F-M7c (item 2): the probe of the evidence store on a REAL directory - the root it
// creates is 0700, and the hidden folders that hold plaintext are reported as the file system has
// them (never followed, never created, never changed by the probe).
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { evidenceStoreProblemOf } from '../checks';
import { probeEvidenceVolume } from '../evidence-volume';

const base = mkdtempSync(join(tmpdir(), 'dems-fm7c-volume-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('the probe of the evidence store', () => {
  it('creates a store root that is not there with mode 0700 (and its parents), and accepts it', () => {
    const root = join(base, 'made', 'media', 'sessions');
    const facts = probeEvidenceVolume(root);
    expect(statSync(root).mode & 0o777).toBe(0o700);
    expect(statSync(join(base, 'made', 'media')).mode & 0o077).toBe(0);
    expect(facts.privateFolders).toEqual([]);
    expect(evidenceStoreProblemOf(facts)).toBeNull();
  });

  it('reports the quarantine and the transcriber scratch as they are: 0755 is refused by name; after chmod 700 the store is accepted (control)', () => {
    const root = join(base, 'open');
    mkdirSync(join(root, '.quarantine'), { recursive: true, mode: 0o700 });
    mkdirSync(join(root, '.transcriber', 'sessions'), { recursive: true, mode: 0o700 });
    chmodSync(root, 0o700);
    chmodSync(join(root, '.quarantine'), 0o755);
    expect(evidenceStoreProblemOf(probeEvidenceVolume(root))).toBe('QUARANTINE_READABLE_BY_OTHERS');
    // The probe changed nothing: the refusal is the operator's to act on.
    expect(statSync(join(root, '.quarantine')).mode & 0o777).toBe(0o755);
    chmodSync(join(root, '.quarantine'), 0o700);
    chmodSync(join(root, '.transcriber', 'sessions'), 0o750);
    expect(evidenceStoreProblemOf(probeEvidenceVolume(root))).toBe('TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS');
    chmodSync(join(root, '.transcriber', 'sessions'), 0o700);
    expect(evidenceStoreProblemOf(probeEvidenceVolume(root))).toBeNull();
  });

  it('a quarantine that is a LINK to another folder is refused (never followed)', () => {
    const root = join(base, 'linked');
    const elsewhere = join(base, 'elsewhere');
    mkdirSync(root, { mode: 0o700 });
    mkdirSync(elsewhere, { mode: 0o700 });
    symlinkSync(elsewhere, join(root, '.quarantine'));
    expect(evidenceStoreProblemOf(probeEvidenceVolume(root))).toBe('QUARANTINE_READABLE_BY_OTHERS');
  });
});
