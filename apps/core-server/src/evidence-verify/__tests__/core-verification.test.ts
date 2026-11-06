// The Core side of verify v2 (blueprint row 85): an item -> its package folder -> the 14 checks
// -> the verdict in the contract's shape -> recorded -> answered; and operation 41 handing a real
// item to it (C3 §3 operation 41). The recorder and the item lookup are stand-ins of this file:
// nothing writes a verdict of the Core into the evidence state yet (note of row 85, "to wire").
import { EvidenceVerifyResultSchema, type EvidenceVerifyResultBody, VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE } from '@dems/shared/api';
import { cameraFilePath, packageFolderName, PackageFile } from '@dems/shared/evidence-package';
import { ROLE_PERMISSIONS } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { WEB_ORIGIN } from '../../../test/support/identity';
import { buildApp } from '../../app';
import type { EngineHost } from '../../engine';
import { evidenceVerification } from '../../modules/evidence';
import type { Principal } from '../../plugins/authenticate';
import { createRealEvidenceVerification, sessionManifestPath, sessionPackageDir, type RealVerificationOptions, type VerdictRecord, contractBodyOf, corePorts } from '../index';
import { buildPackage, flipByte, removeScratch, type BuiltPackage, NOW } from './support';
import { VERIFY_NOTICE, verifyPackageV2, verifyReportLines, type PackageVerifyResult, REVISION_APPEND_PENDING_FILE, REVISION_APPEND_PENDING_REPORT } from '@dems/shared/evidence-verify';

afterAll(removeScratch);

const OPERATOR: Principal = { kind: 'OPERATOR', operatorId: 'OPR-001', sessionId: 'session', deviceId: null, role: 'INVESTIGATOR', permissions: ROLE_PERMISSIONS.INVESTIGATOR };
const AT = 1_791_600_000_000;

function coreVerification(built: BuiltPackage, overrides: Partial<RealVerificationOptions> = {}) {
  const recorded: { principal: Principal; verdict: VerdictRecord }[] = [];
  let clockReads = 0;
  const verification = createRealEvidenceVerification({
    findItem: (evidenceId) => (evidenceId === built.item.evidenceId ? built.item : null),
    packageDirOf: () => built.dir,
    now: () => {
      clockReads += 1;
      return AT + clockReads - 1;
    },
    opener: built.opener,
    trustedCertificateSha256: () => [built.signer.certificate.sha256],
    record: async (principal, verdict) => void recorded.push({ principal, verdict }),
    chunkBytes: 512,
    ...overrides,
  });
  return { verification, recorded, clockReads: () => clockReads };
}

describe('the verdict of record of a real v2 item', () => {
  it('a sealed package: ok, the contract\'s shape, recorded once with the same instant, the clock read once', async () => {
    const built = await buildPackage({ revisions: 1 });
    const { verification, recorded, clockReads } = coreVerification(built);
    const run = await verification.run(OPERATOR, built.item.evidenceId);
    if (run === null) throw new Error('no run');
    expect(EvidenceVerifyResultSchema.parse(run.body)).toEqual({
      evidenceId: 'EV-20261009-0001',
      ok: true,
      at: AT,
      tracks: [],
      files: [
        { fileId: 'fragments/VIDEO-01.mp4', trackId: 'VIDEO-01', storedOk: true, plainOk: true, chainOk: true, fragmentCount: 5, ok: true },
        { fileId: 'fragments/VIDEO-02.mp4', trackId: 'VIDEO-02', storedOk: true, plainOk: true, chainOk: true, fragmentCount: 5, ok: true },
      ],
      transcriptOk: true,
      manifestOk: true,
      signatureOk: true,
      // The report members (rows 85, 119, 141): all 15 checks, no failed fragment, the transcript
      // state, and the sources of the example's four FAKE rows.
      overall: 'PASS',
      interrupted: false,
      checks: run.report.checks.map((check) => ({ id: check.id, name: check.name, status: 'PASS', failureClass: null, skipped: null, findings: [] })),
      fragments: [],
      failedFragmentCount: 0,
      transcriptState: { code: 'READY', report: 'Transcript sealed', sealedState: 'ASSEMBLED', reason: null, documentSealed: true, failedChunks: 0, backendUnreachable: false },
      // Pass D10 (D160): the model of the sealed transcript; the example session is `cpu-local`, so all four members are stated.
      transcriptModel: {
        name: built.manifest.transcript.model.name,
        version: built.manifest.transcript.model.version,
        quantisation: built.manifest.transcript.model.quantisation,
        modelSha256: built.manifest.transcript.model.modelSha256,
        reportedByServer: false,
        report: `Transcript model: ${built.manifest.transcript.model.name}, version ${built.manifest.transcript.model.version} (declared by the installation), quantisation ${built.manifest.transcript.model.quantisation}, file SHA-256 ${built.manifest.transcript.model.modelSha256}`,
      },
      sources: {
        ok: true,
        code: 'DEVELOPMENT',
        development: true,
        report: 'DEVELOPMENT SOURCES \u2014 this package was not recorded from production devices.',
        tracks: [
          { trackId: 'VIDEO-01', deviceId: 'CAM-01', sourceClass: 'FAKE' },
          { trackId: 'VIDEO-02', deviceId: 'CAM-02', sourceClass: 'FAKE' },
        ],
        audioIntervals: [
          { seq: 1, micDeviceId: 'MIC-01', sourceClass: 'FAKE' },
          { seq: 2, micDeviceId: 'MIC-02', sourceClass: 'FAKE' },
        ],
      },
      // Decision D147: the key of this package carries no development mark (a throw-away key of the signer).
      signature: { developmentKey: false },
      // Fix pass F-M7 (R88-06): the audit extract is in the package and nothing signs its content - said on every v2 answer.
      notices: [{ code: 'AUDIT_EXTRACT_NOT_SIGNED', report: 'Audit extract: present, NOT covered by the package signature.' }],
    });
    expect(run.report.checks.map((check) => check.status)).toEqual(Array.from({ length: 15 }, () => 'PASS'));
    expect(recorded).toEqual([{ principal: OPERATOR, verdict: { evidenceId: 'EV-20261009-0001', ok: true, at: AT, manifestOk: true, signatureOk: true, failedTracks: [], detail: null, failedFragments: [] } }]);
    expect(clockReads()).toBe(1);
    expect(Object.isFrozen(run.body)).toBe(true);
  });

  it('one tampered fragment: ok false, exactly that file, and the custody text names the fragment (M7-TP-1)', async () => {
    const built = await buildPackage();
    flipByte(built.path(cameraFilePath('VIDEO-02')), built.fragment('VIDEO-02', 3).byteOffset + 9);
    const { verification, recorded } = coreVerification(built);
    const body = await verification.verify(OPERATOR, built.item.evidenceId);
    expect(EvidenceVerifyResultSchema.parse(body)).toMatchObject({
      ok: false,
      files: [
        { trackId: 'VIDEO-01', storedOk: true, plainOk: true, chainOk: true, ok: true },
        { trackId: 'VIDEO-02', storedOk: false, plainOk: false, chainOk: false, ok: false },
      ],
      transcriptOk: true,
      manifestOk: true,
      signatureOk: true,
    });
    expect(recorded.map((entry) => entry.verdict)).toEqual([
      { evidenceId: 'EV-20261009-0001', ok: false, at: AT, manifestOk: true, signatureOk: true, failedTracks: ['VIDEO-02'], detail: 'Mismatch: VIDEO-02 fragment 3', failedFragments: ['VIDEO-02:3'] }, // fix wave K (G89b-04): the fragment, for the audit row
    ]);
  });

  it('the Core verifies with its anchors: a package of another item in the folder, and no session key, are failures', async () => {
    const built = await buildPackage();
    const other = await buildPackage({ signer: built.signer });
    const swapped = coreVerification(built, { packageDirOf: () => other.dir, opener: other.opener });
    expect(await swapped.verification.verify(OPERATOR, built.item.evidenceId)).toMatchObject({ ok: false, manifestOk: false, signatureOk: true });
    expect(swapped.recorded[0]?.verdict).toMatchObject({ ok: false, detail: 'Mismatch: V-03' });

    const keyless = coreVerification(built, { opener: null });
    expect(await keyless.verification.verify(OPERATOR, built.item.evidenceId)).toMatchObject({
      ok: false,
      files: [{ storedOk: true, plainOk: false, chainOk: true, ok: false }, { storedOk: true, plainOk: false, chainOk: true, ok: false }],
      manifestOk: true,
      signatureOk: true,
    });
    expect(keyless.recorded[0]?.verdict.detail).toBe('Mismatch: V-05');
  });

  it('a package with a transcript disabled by configuration answers without transcriptOk', async () => {
    const built = await buildPackage({ transcript: 'DISABLED' });
    const body = await coreVerification(built).verification.verify(OPERATOR, built.item.evidenceId);
    expect(body).toMatchObject({ ok: true });
    expect(body).not.toHaveProperty('transcriptOk');
  });

  it('a verdict that could not be recorded is not answered; an item that is not a real one is not verified and not recorded', async () => {
    const built = await buildPackage();
    const refused = coreVerification(built, { record: async () => Promise.reject(new Error('the unit was not committed')) });
    await expect(refused.verification.verify(OPERATOR, built.item.evidenceId)).rejects.toThrow('the unit was not committed');

    const { verification, recorded, clockReads } = coreVerification(built);
    expect(await verification.verify(OPERATOR, 'EV-20260930-0004')).toBeNull();
    expect(recorded).toEqual([]);
    expect(clockReads()).toBe(0);
  });

  it('the package folder of a session is SESSION-<sessionId> below the media store; the manifest file follows the version (D133 (2))', () => {
    expect(sessionPackageDir('/data/media/sessions', 'SES-20261009-0001')).toBe('/data/media/sessions/SESSION-SES-20261009-0001');
    expect(sessionManifestPath('/data/media/sessions', 'SES-20261009-0001', 2)).toBe('/data/media/sessions/SESSION-SES-20261009-0001/session-manifest.json');
    expect(sessionManifestPath('/data/media/sessions', 'SES-20261009-0001', 1)).toBe('/data/media/sessions/SESSION-SES-20261009-0001/manifest.json');
    for (const name of ['..', '../SES-1', 'a/b', '', '.hidden']) expect(() => sessionPackageDir('/data/media/sessions', name)).toThrow();
  });

  it('a package in SESSION-<sessionId>/ verifies through the store layout; the same package in a bare <sessionId>/ folder is not a package', async () => {
    const layout = (store: string) => ({ packageDirOf: (sessionId: string) => sessionPackageDir(store, sessionId) });
    const inPlace = await buildPackage({ folderName: packageFolderName('SES-20261009-0001') });
    expect(inPlace.dir).toBe(sessionPackageDir(dirname(inPlace.dir), inPlace.item.sessionId));
    expect(existsSync(sessionManifestPath(dirname(inPlace.dir), inPlace.item.sessionId, 2))).toBe(true);
    const found = await coreVerification(inPlace, layout(dirname(inPlace.dir))).verification.run(OPERATOR, inPlace.item.evidenceId);
    expect(found?.body).toMatchObject({ ok: true, overall: 'PASS' });

    // The SAME builder, the folder named after the session alone: every file is there, and the layout does not read it.
    const bare = await buildPackage({});
    expect(basename(bare.dir)).toBe(bare.item.sessionId);
    expect(existsSync(join(bare.dir, 'session-manifest.json'))).toBe(true);
    const missed = await coreVerification(bare, layout(dirname(bare.dir))).verification.run(OPERATOR, bare.item.evidenceId);
    expect(missed?.body.ok).toBe(false);
    expect(missed?.body.overall).not.toBe('PASS');
    // CONTROL: handed its own folder directly, the bare-folder package is intact - only the layout refuses it.
    expect((await coreVerification(bare).verification.run(OPERATOR, bare.item.evidenceId))?.body.ok).toBe(true);
  });
});

describe('operation 41 with a real item (the route of the evidence module)', () => {
  const apps: FastifyInstance[] = [];
  afterEach(async () => {
    for (const app of apps.splice(0)) await app.close();
  });

  async function serve(built: BuiltPackage) {
    const refuse = async (): Promise<never> => Promise.reject(Object.assign(new Error('no database in this test'), { code: 'ECONNREFUSED' }));
    const pool = { connect: refuse, query: refuse, on: () => pool, end: async () => {} };
    const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => pool as unknown as Pool, logStream: captureLog().stream });
    apps.push(app);
    app.stages.replace('authenticate', (request) => {
      request.principal = OPERATOR;
    });
    const core = coreVerification(built);
    evidenceVerification(app).provide(core.verification);
    await app.ready();
    app.readiness.set('database', true);
    app.readiness.set('engine', true);
    const commands: unknown[][] = [];
    const sim: EvidenceVerifyResultBody = { evidenceId: 'EV-20260930-0004', ok: true, at: 5, tracks: [], manifestOk: true, signatureOk: true };
    app.seams.replace('engine', {
      epoch: 1,
      revision: 1,
      running: true,
      command: async (...args: unknown[]) => (commands.push(args), { value: sim, epoch: 1, revision: 1 }),
    } as unknown as EngineHost);
    const post = (evidenceId: string) => app.inject({ method: 'POST', url: `/api/v1/evidence/${evidenceId}/verify`, headers: { origin: WEB_ORIGIN } });
    return { post, commands, core, sim };
  }

  it('a real item is verified from its files and never reaches the simulator; every other item takes the hosted action as before', async () => {
    const built = await buildPackage();
    const { post, commands, core, sim } = await serve(built);

    const real = await post(built.item.evidenceId);
    expect(real.statusCode).toBe(200);
    expect(real.json()).toMatchObject({ evidenceId: built.item.evidenceId, ok: true, at: AT, tracks: [], manifestOk: true, signatureOk: true, transcriptOk: true });
    expect(real.json().files).toHaveLength(2);
    expect(commands).toEqual([]);
    expect(core.recorded).toHaveLength(1);

    flipByte(built.path(cameraFilePath('VIDEO-01')), built.fragment('VIDEO-01', 1).byteOffset);
    const tampered = await post(built.item.evidenceId);
    expect(tampered.statusCode).toBe(200);
    expect(tampered.json()).toMatchObject({ ok: false, files: [{ trackId: 'VIDEO-01', ok: false }, { trackId: 'VIDEO-02', ok: true }] });
    expect(core.recorded.map((entry) => entry.verdict.detail)).toEqual([null, 'Mismatch: VIDEO-01 fragment 1']);

    const demo = await post('EV-20260930-0004');
    expect(demo.statusCode).toBe(200);
    expect(demo.json()).toEqual(sim);
    expect(commands.map((args) => args.slice(1))).toEqual([['verify', 'EV-20260930-0004']]);
    expect(core.recorded).toHaveLength(2);
  });
});

const verify = (built: BuiltPackage): Promise<PackageVerifyResult> =>
  verifyPackageV2(corePorts(built.dir, built.opener, 256), { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [built.signer.certificate.sha256] } });

describe('D185 (a): what lies under export/ (fix pass F-M7b)', () => {
  // Fix pass F-M7b, controller decision D185 (a): verify skips everything under `export/` (derived
  // files beside the sealed set). The FINISHED artefacts of an export are legitimate there; anything
  // else - a `.partial` a crash left, a name the export never writes - is said by ONE named notice
  // that fails nothing: `EXPORT_FOLDER_UNEXPECTED_FILE`. A file name is shown only when it is a plain
  // name of a closed form; never free text.

  afterAll(removeScratch);
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
});

describe('D187: a staged revision list is a pending write (fix pass F-M7c)', () => {
  // Fix pass F-M7c, controller decision D187: the revision writer stages
  // `transcript/transcript-revisions.json.next` in the package folder (the table is the journal; the
  // staged file is judged against the table at boot). While it is pending, the package is INTACT:
  // that EXACT name is not a V-14 failure - it is the named, non-failing notice
  // `REVISION_APPEND_PENDING`. Any other unexpected name still fails V-14, and V-11 judges only the
  // committed `transcript-revisions.json`.

  afterAll(removeScratch);
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
});

describe('G89b-06: operation 41 says whether the plaintext check ran (wave K, reconcile pass)', () => {
  /**
   * Fix wave K, reconcile pass (G89b-06, the Core's half): operation 41 says for each camera file
   * whether the plaintext check (V-05) RAN. `plainOk` stays a strict boolean; `plainChecked: false`
   * is added only where the check did not run for that file, so that no client reads
   * "decrypted bytes FAIL" out of `plainOk: false`.
   */

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
});
