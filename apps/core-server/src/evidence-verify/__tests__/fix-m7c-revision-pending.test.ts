// Fix pass F-M7c, controller decision D187: the revision writer stages
// `transcript/transcript-revisions.json.next` in the package folder (the table is the journal; the
// staged file is judged against the table at boot). While it is pending, the package is INTACT:
// that EXACT name is not a V-14 failure - it is the named, non-failing notice
// `REVISION_APPEND_PENDING`. Any other unexpected name still fails V-14, and V-11 judges only the
// committed `transcript-revisions.json`.
import { EvidenceVerifyResultSchema } from '@dems/shared/api';
import { PackageFile } from '@dems/shared/evidence-package';
import { REVISION_APPEND_PENDING_FILE, REVISION_APPEND_PENDING_REPORT, VERIFY_NOTICE, verifyPackageV2, verifyReportLines, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { contractBodyOf, corePorts } from '../index';
import { NOW, buildPackage, removeScratch, type BuiltPackage } from './support';

afterAll(removeScratch);

const verify = (built: BuiltPackage): Promise<PackageVerifyResult> =>
  verifyPackageV2(corePorts(built.dir, built.opener, 256), { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [built.signer.certificate.sha256] } });
const put = (built: BuiltPackage, relative: string, content = 'not a revision list'): void => {
  mkdirSync(join(built.dir, relative, '..'), { recursive: true });
  writeFileSync(join(built.dir, relative), content);
};
const failed = (result: PackageVerifyResult): string[] => result.checks.filter((check) => check.status === 'FAIL').map((check) => check.id);

describe('D187: a staged revision list is a pending write, not an unexpected file', () => {
  it('the exact staged name: the package passes 15 of 15 with ONE notice REVISION_APPEND_PENDING; V-11 judged the committed file only', async () => {
    const built = await buildPackage();
    expect(REVISION_APPEND_PENDING_FILE).toBe(`${PackageFile.TRANSCRIPT_REVISIONS}.next`);
    // The staged bytes are NOT a valid list: were V-11 to read them it would fail.
    put(built, REVISION_APPEND_PENDING_FILE);
    const result = await verify(built);
    expect(failed(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.notices.map((notice) => notice.code)).toEqual(['AUDIT_EXTRACT_NOT_SIGNED', 'REVISION_APPEND_PENDING']);
    expect(result.notices.find((notice) => notice.code === VERIFY_NOTICE.REVISION_APPEND_PENDING)?.report).toBe('A transcript revision is being written; verify again shortly.');
    expect(REVISION_APPEND_PENDING_REPORT).toBe('A transcript revision is being written; verify again shortly.');
    expect(verifyReportLines(result)).toContain(REVISION_APPEND_PENDING_REPORT);
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf('EV-20261009-0001', NOW, result));
    expect(body.notices?.map((notice) => notice.code)).toEqual(['AUDIT_EXTRACT_NOT_SIGNED', 'REVISION_APPEND_PENDING']);
  });

  it.each(['transcript/transcript-revisions.json.next2', 'transcript/transcript-revisions.json.nex', 'transcript-revisions.json.next', 'transcript/transcript.json.next', 'transcript/x/transcript-revisions.json.next'])('CONTROL: the look-alike name %s still fails V-14 UNEXPECTED_FILE and raises no pending notice', async (name) => {
    const built = await buildPackage();
    put(built, name);
    const result = await verify(built);
    expect(failed(result)).toEqual(['V-14']);
    expect(result.checks.find((check) => check.id === 'V-14')?.findings.map((finding) => finding.code)).toEqual(['UNEXPECTED_FILE']);
    expect(result.notices.map((notice) => notice.code)).not.toContain('REVISION_APPEND_PENDING');
  });

  it('CONTROL: a package without the staged file carries no pending notice', async () => {
    const result = await verify(await buildPackage());
    expect(result.notices.map((notice) => notice.code)).toEqual(['AUDIT_EXTRACT_NOT_SIGNED']);
  });
});
