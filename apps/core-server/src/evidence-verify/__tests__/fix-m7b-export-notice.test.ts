// Fix pass F-M7b, controller decision D185 (a): verify skips everything under `export/` (derived
// files beside the sealed set). The FINISHED artefacts of an export are legitimate there; anything
// else - a `.partial` a crash left, a name the export never writes - is said by ONE named notice
// that fails nothing: `EXPORT_FOLDER_UNEXPECTED_FILE`. A file name is shown only when it is a plain
// name of a closed form; never free text.
import { EvidenceVerifyResultSchema } from '@dems/shared/api';
import { VERIFY_NOTICE, verifyPackageV2, verifyReportLines, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { contractBodyOf, corePorts } from '../index';
import { NOW, buildPackage, removeScratch, type BuiltPackage } from './support';

afterAll(removeScratch);

const verify = (built: BuiltPackage): Promise<PackageVerifyResult> =>
  verifyPackageV2(corePorts(built.dir, built.opener, 256), { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [built.signer.certificate.sha256] } });
const put = (built: BuiltPackage, relative: string): void => {
  mkdirSync(join(built.dir, relative, '..'), { recursive: true });
  writeFileSync(join(built.dir, relative), 'x');
};
const exportNotice = (result: PackageVerifyResult) => result.notices.find((notice) => notice.code === VERIFY_NOTICE.EXPORT_FOLDER_UNEXPECTED_FILE);

describe('D185 (a): what lies under export/ and is no finished export artefact is NAMED, and fails nothing', () => {
  it('a `.partial` and an unknown name: one notice with the count and the plain names; the package still passes 15 of 15', async () => {
    const built = await buildPackage();
    put(built, 'export/EXP-000007.zip.partial');
    put(built, 'export/notes.txt');
    const result = await verify(built);
    expect(result.ok).toBe(true);
    expect(result.checks.every((check) => check.status === 'PASS')).toBe(true);
    expect(result.notices.map((notice) => notice.code)).toEqual(['AUDIT_EXTRACT_NOT_SIGNED', 'EXPORT_FOLDER_UNEXPECTED_FILE']);
    expect(exportNotice(result)?.report).toBe('Export folder: 2 files that are no finished export (EXP-000007.zip.partial, notes.txt). They are not part of the sealed package.');
    expect(verifyReportLines(result)).toContain(exportNotice(result)?.report);
    // Operation 41 carries it, inside the contract's form.
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf('EV-20261009-0001', NOW, result));
    expect(body.notices?.map((notice) => notice.code)).toEqual(['AUDIT_EXTRACT_NOT_SIGNED', 'EXPORT_FOLDER_UNEXPECTED_FILE']);
  });

  it('a name that is no plain name is COUNTED and never printed (no free text reaches a report or a log)', async () => {
    const built = await buildPackage();
    put(built, 'export/please run rm -rf $(HOME).txt');
    put(built, 'export/deeper/EXP-000001.zip');
    for (let index = 0; index < 5; index += 1) put(built, `export/stray-${index}.bin`);
    const result = await verify(built);
    expect(result.ok).toBe(true);
    const report = exportNotice(result)?.report ?? '';
    expect(report).toBe('Export folder: 7 files that are no finished export (stray-0.bin, stray-1.bin, stray-2.bin, and 4 more). They are not part of the sealed package.');
    expect(report).not.toMatch(/rm -rf|deeper|\$/);
    expect(report.length).toBeLessThanOrEqual(256);
  });

  it('CONTROL: the finished artefacts of an export, and a composite, raise no notice', async () => {
    const built = await buildPackage();
    for (const name of ['EXP-000001.zip', 'EXP-000001.manifest.json', 'EXP-000001.manifest.sig', 'export-manifest.json', 'export-manifest.sig']) put(built, `export/${name}`);
    put(built, 'composite/composite.mp4');
    const result = await verify(built);
    expect(result.ok).toBe(true);
    expect(result.notices.map((notice) => notice.code)).toEqual(['AUDIT_EXTRACT_NOT_SIGNED']);
  });

  it('CONTROL: a stray file OUTSIDE export/ is still a failure of V-14, not a notice', async () => {
    const built = await buildPackage();
    put(built, 'stray.bin');
    const result = await verify(built);
    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.id === 'V-14')?.findings.map((finding) => finding.code)).toEqual(['UNEXPECTED_FILE']);
    expect(exportNotice(result)).toBeUndefined();
  });
});
