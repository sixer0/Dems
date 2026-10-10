/**
 * Fix wave K, reconcile pass (G89b-06, the Core's half): operation 41 says for each camera file
 * whether the plaintext check (V-05) RAN. `plainOk` stays a strict boolean; `plainChecked: false`
 * is added only where the check did not run for that file, so that no client reads
 * "decrypted bytes FAIL" out of `plainOk: false`.
 */
import { describe, expect, it } from 'vitest';
import { EvidenceVerifyResultSchema, VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE } from '@dems/shared/api';
import type { PackageVerifyResult } from '@dems/shared/evidence-verify';
import { contractBodyOf } from '../index';

type FileRow = PackageVerifyResult['files'][number];
type Check = PackageVerifyResult['checks'][number];

const file = (trackId: string, storedOk: boolean, plainOk: boolean | null): FileRow => ({
  trackId,
  file: `fragments/${trackId}.mp4`,
  fragmentCount: 5,
  storedOk,
  plainOk,
  chainOk: storedOk,
  sequenceOk: true,
  chainBrokenFromSeq: storedOk ? null : 3,
  fragments: [],
});

const check = (id: string, status: Check['status'], findings: Check['findings'] = [], skipped: Check['skipped'] = null): Check =>
  ({ id, name: id, status, failureClass: findings[0]?.failureClass ?? null, skipped, findings }) as Check;

function report(files: readonly FileRow[], v05: Check): PackageVerifyResult {
  return {
    ok: false,
    overall: 'TAMPERED',
    interrupted: false,
    files,
    checks: [v05],
    fragments: [],
    transcript: { state: 'READY' },
    transcriptState: { code: 'READY', report: 'Transcript sealed', sealedState: 'ASSEMBLED', reason: null, documentSealed: true, failedChunks: 0, backendUnreachable: false },
    transcriptModel: null,
    sources: { ok: true, code: 'PRODUCTION', development: false, report: '', tracks: [], audioIntervals: [] },
    signature: { developmentKey: null },
    notices: [],
  } as unknown as PackageVerifyResult;
}

describe('operation 41 files[].plainChecked (fix wave K, G89b-06)', () => {
  it('a file whose plaintext check did not run answers plainOk false AND plainChecked false; a checked file carries no member', () => {
    const body = contractBodyOf('EV-20261009-0001', 1, report([file('VIDEO-01', true, true), file('VIDEO-02', false, null)], check('V-05', 'SKIPPED', [], 'BLOCKED')));
    expect(body.files).toEqual(VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE);
    expect(body.files?.[0]).not.toHaveProperty('plainChecked');
  });

  it('control: a comparison that FAILED, and a required key that is missing (a V-05 finding of the track), stay plain failures without the member', () => {
    const mismatch = contractBodyOf('EV-20261009-0001', 1, report([file('VIDEO-01', true, false)], check('V-05', 'FAIL', [{ code: 'PLAINTEXT_HASH_MISMATCH', failureClass: 'TAMPERED', trackId: 'VIDEO-01' }] as Check['findings'])));
    expect(mismatch.files?.[0]).toMatchObject({ plainOk: false });
    expect(mismatch.files?.[0]).not.toHaveProperty('plainChecked');
    const keyless = contractBodyOf('EV-20261009-0001', 1, report([file('VIDEO-01', true, null), file('VIDEO-02', false, null)], check('V-05', 'FAIL', [{ code: 'SESSION_KEY_UNAVAILABLE', failureClass: 'TAMPERED', trackId: 'VIDEO-01' }] as Check['findings'])));
    expect(keyless.files?.[0]).not.toHaveProperty('plainChecked');
    // The other file of the same answer was not checked and V-05 names no finding of it: it says so.
    expect(keyless.files?.[1]).toMatchObject({ plainOk: false, plainChecked: false });
  });

  it('the contract: the member is optional and a boolean; the example parses', () => {
    const base = { evidenceId: 'EV-20261009-0001', ok: false, at: 1, tracks: [], manifestOk: true, signatureOk: true };
    expect(EvidenceVerifyResultSchema.safeParse({ ...base, files: VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE }).success).toBe(true);
    expect(EvidenceVerifyResultSchema.safeParse({ ...base, files: [{ ...VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE[1], plainChecked: 'no' }] }).success).toBe(false);
    expect(VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE.map((row) => row.plainChecked)).toEqual([undefined, false]);
  });
});
