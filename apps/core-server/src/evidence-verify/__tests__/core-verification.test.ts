// The Core side of verify v2 (blueprint row 85): an item -> its package folder -> the 14 checks
// -> the verdict in the contract's shape -> recorded -> answered; and operation 41 handing a real
// item to it (C3 §3 operation 41). The recorder and the item lookup are stand-ins of this file:
// nothing writes a verdict of the Core into the evidence state yet (note of row 85, "to wire").
import { EvidenceVerifyResultSchema, type EvidenceVerifyResultBody } from '@dems/shared/api';
import { cameraFilePath, packageFolderName } from '@dems/shared/evidence-package';
import { ROLE_PERMISSIONS } from '@dems/shared/sim';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { WEB_ORIGIN } from '../../../test/support/identity';
import { buildApp } from '../../app';
import type { EngineHost } from '../../engine';
import { evidenceVerification } from '../../modules/evidence';
import type { Principal } from '../../plugins/authenticate';
import { createRealEvidenceVerification, sessionManifestPath, sessionPackageDir, type RealVerificationOptions, type VerdictRecord } from '../index';
import { buildPackage, flipByte, removeScratch, type BuiltPackage } from './support';

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
