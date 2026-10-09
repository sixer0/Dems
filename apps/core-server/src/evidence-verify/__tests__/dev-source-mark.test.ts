// The development-source mark in verify v2 (blueprint row 141, R-11; evidence package spec §B.12,
// §D V-15, §D.1, §H.5; test strategy §A.4a).
//
//   M7-DEVSRC-SEAL-1    a package built from a DEVELOPMENT plan - the four `session_capture_sources`
//                       rows of row 136's builder: this Mac's camera and microphone in slot 1, the
//                       test sources in slot 2 - carries the classes, verifies PASS on 15 checks,
//                       and its report starts with the development line
//   M7-DEVSRC-TAMPER-1  an edited mark fails: a raw edit -> the manifest hash (V-03); re-hashed
//                       without a valid signature -> V-09; the flag deleted -> V-15 MISSING; a
//                       re-signed forgery of the flag alone -> V-15 CORRUPT; and no edited class is
//                       ever repeated as fact
//   M7-SEC-SRC-2        (this file's half) the class comes from the adapter kind: a class smuggled
//                       into the builder's input is overwritten; the signed mark reader of the
//                       reset guard answers `development` only for a verified development manifest
//
// Every package is real bytes on disk, real SHA-256, AES-256-GCM, Ed25519 of a throw-away key
// (`support.ts`). Each claim has a control that makes it able to fail.
import { EvidenceVerifyResultSchema } from '@dems/shared/api';
import { PackageFile, buildUnsignedManifest, exampleManifestInput, type ManifestV2Input, type SessionCaptureSourceRow } from '@dems/shared/evidence-package';
import {
  SOURCES_STATE_REPORT,
  VERIFY_V2_CHECKS,
  verifyPackageV2,
  verifyReportLines,
  type PackageVerifyResult,
  type VerifyCheckId,
  type VerifyOptions,
} from '@dems/shared/evidence-verify';
import { rmSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { CaptureOperation, type CaptureAdapterKind } from '../../capture/adapters';
import { buildSessionCaptureSources, type RecordedSlot } from '../../capture/fence';
import { contractBodyOf, corePorts, readSealedSourceMark } from '../index';
import { buildPackage, editManifest, flipByte, removeScratch, throwAwaySigner, type BuildOptions, type BuiltPackage } from './support';

afterAll(removeScratch);

const DEVELOPMENT_LINE = 'DEVELOPMENT SOURCES — this package was not recorded from production devices.';
const PRODUCTION_LINE = 'Sources: declared as production devices by the Core that sealed this package.';
const NOT_TRUSTWORTHY_LINE = 'Sources: not trustworthy — the manifest was altered';
const SESSION_ID = 'SES-20261009-0001';
const EVIDENCE_ID = 'EV-20261009-0001';
const ALL: VerifyCheckId[] = VERIFY_V2_CHECKS.map((check) => check.id);

const slot = (name: RecordedSlot['slot'], id: string, deviceClass: 'CAMERA' | 'MIC', adapterKind: CaptureAdapterKind): RecordedSlot => ({ slot: name, descriptor: { id, deviceClass, adapterKind, hasOpener: true } });

/** The development plan of D74(2), as ROW 136's builder writes it for a session start in `REAL_DEVELOPMENT`. */
function developmentRows(): SessionCaptureSourceRow[] {
  const rows = buildSessionCaptureSources({
    sessionId: SESSION_ID,
    operation: CaptureOperation.REAL_DEVELOPMENT,
    slots: [slot('VIDEO-01', 'CAM-03', 'CAMERA', 'LOCAL_DEVICE'), slot('VIDEO-02', 'CAM-02', 'CAMERA', 'FAKE'), slot('PRIMARY', 'MIC-03', 'MIC', 'LOCAL_DEVICE'), slot('STANDBY', 'MIC-02', 'MIC', 'FAKE')],
    recordedAt: 1_791_500_000_000,
  });
  return rows.map((row) => ({ slot: row.slot, deviceId: row.deviceId, adapterKind: row.adapterKind }));
}

/** No builder of this phase makes these rows (D86 C-5: a production session cannot start): written by hand, for the wording of §H.5 only. */
const PRODUCTION_ROWS: readonly SessionCaptureSourceRow[] = [
  { slot: 'VIDEO-01', deviceId: 'CAM-07', adapterKind: 'ONVIF_RTSP' },
  { slot: 'VIDEO-02', deviceId: 'CAM-08', adapterKind: 'ONVIF_RTSP' },
  { slot: 'MIC-PRIMARY', deviceId: 'MIC-07', adapterKind: 'USB_AUDIO' },
  { slot: 'MIC-STANDBY', deviceId: 'MIC-08', adapterKind: 'USB_AUDIO' },
];

type Loose = { tracks: { deviceId: string }[]; audio: { sourceIntervals: { micDeviceId: string }[] } };
/** The devices of the manifest are the devices of the rows (the classes are NOT set here: the builder derives them). */
const devicesOf =
  (rows: readonly SessionCaptureSourceRow[]) =>
  (input: ManifestV2Input): void => {
    const loose = input as unknown as Loose;
    const id = (name: string): string => rows.find((row) => row.slot === name)?.deviceId ?? '';
    loose.tracks.forEach((track, index) => (track.deviceId = id(index === 0 ? 'VIDEO-01' : 'VIDEO-02')));
    loose.audio.sourceIntervals.forEach((interval, index) => (interval.micDeviceId = id(index === 0 ? 'MIC-PRIMARY' : 'MIC-STANDBY')));
  };

const developmentPackage = (options: BuildOptions = {}): Promise<BuiltPackage> => {
  const rows = developmentRows();
  return buildPackage({ revisions: 1, sourceRows: rows, beforeSeal: devicesOf(rows), ...options });
};
const productionPackage = (): Promise<BuiltPackage> => buildPackage({ revisions: 1, sourceRows: PRODUCTION_ROWS, beforeSeal: devicesOf(PRODUCTION_ROWS) });

/** As a holder of the folder runs it: no anchor from outside. */
const alone = (built: BuiltPackage, options: VerifyOptions = {}): Promise<PackageVerifyResult> => verifyPackageV2(corePorts(built.dir, built.opener, 256), options);
/** As the Core runs it: every anchor it has (the item's sealed digest, its own certificates). */
const atCore = (built: BuiltPackage, trusted: readonly string[] = [built.signer.certificate.sha256]): Promise<PackageVerifyResult> =>
  alone(built, { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: trusted } });

const statusOf = (result: PackageVerifyResult, id: VerifyCheckId): string => result.checks.find((check) => check.id === id)?.status ?? 'none';
const failing = (result: PackageVerifyResult): VerifyCheckId[] => result.checks.filter((check) => check.status === 'FAIL').map((check) => check.id);
const v15 = (result: PackageVerifyResult) => {
  const check = result.checks.find((entry) => entry.id === 'V-15');
  if (check === undefined) throw new Error('no V-15');
  return { status: check.status, failureClass: check.failureClass, skipped: check.skipped, found: check.findings.map((finding) => `${finding.code} ${finding.failureClass} ${finding.member ?? ''}`) };
};

/** Nothing of an altered manifest is repeated as fact: the line, the code, no class, no boolean. */
function expectNotTrustworthy(result: PackageVerifyResult): void {
  expect(result.ok).toBe(false);
  expect(result.sources).toMatchObject({ code: 'NOT_TRUSTWORTHY', development: null, report: NOT_TRUSTWORTHY_LINE, lines: [], tracks: [], audioIntervals: [] });
  const lines = verifyReportLines(result);
  expect(lines[0]).toBe(NOT_TRUSTWORTHY_LINE);
  expect(lines.join('\n')).not.toMatch(/LOCAL_DEVICE|FAKE|PRODUCTION \(|declared as production|DEVELOPMENT SOURCES/);
  const body = contractBodyOf(EVIDENCE_ID, 1, result);
  expect(EvidenceVerifyResultSchema.parse(body).sources).toEqual({ ok: result.sources.ok, code: 'NOT_TRUSTWORTHY', development: null, report: NOT_TRUSTWORTHY_LINE, tracks: [], audioIntervals: [] });
}

describe('M7-DEVSRC-SEAL-1: a package sealed from a development plan carries the classes and verifies PASS, the development line first', () => {
  it('the manifest carries one class per camera file and per audio interval, from the adapter kinds of the four source rows', async () => {
    const rows = developmentRows();
    expect(rows.map((row) => `${row.slot} ${row.deviceId} ${row.adapterKind}`)).toEqual(['VIDEO-01 CAM-03 LOCAL_DEVICE', 'VIDEO-02 CAM-02 FAKE', 'MIC-PRIMARY MIC-03 LOCAL_DEVICE', 'MIC-STANDBY MIC-02 FAKE']);
    const built = await developmentPackage();
    expect(built.manifest.tracks.map((track) => `${track.trackId} ${track.deviceId} ${track.sourceClass}`)).toEqual(['VIDEO-01 CAM-03 LOCAL_DEVICE', 'VIDEO-02 CAM-02 FAKE']);
    // A microphone switch from the local to the fake one: two intervals, two classes (rule 4).
    expect(built.manifest.audio.sourceIntervals.map((interval) => `${interval.seq} ${interval.micDeviceId} ${interval.sourceClass}`)).toEqual(['1 MIC-03 LOCAL_DEVICE', '2 MIC-02 FAKE']);
    expect(built.manifest.developmentSources).toBe(true);
  });

  it('15 checks, each PASS; ok; the first report line is the development line, the entries follow, the integrity verdict is unchanged', async () => {
    const built = await developmentPackage();
    for (const result of [await atCore(built), await alone(built)]) {
      expect(result.checks.map((check) => `${check.id} ${check.status}`)).toEqual(ALL.map((id) => `${id} PASS`));
      expect(result.checks).toHaveLength(15);
      expect(result).toMatchObject({ ok: true, overall: 'PASS' });
      expect(result.sources).toEqual({
        ok: true,
        code: 'DEVELOPMENT',
        development: true,
        report: DEVELOPMENT_LINE,
        lines: ["VIDEO-01: CAM-03, this computer's camera (LOCAL_DEVICE).", 'VIDEO-02: CAM-02, fake source (FAKE).', "AUDIO-01: interval 1 MIC-03, this computer's microphone (LOCAL_DEVICE); interval 2 MIC-02, fake source (FAKE)."],
        tracks: [
          { trackId: 'VIDEO-01', deviceId: 'CAM-03', sourceClass: 'LOCAL_DEVICE' },
          { trackId: 'VIDEO-02', deviceId: 'CAM-02', sourceClass: 'FAKE' },
        ],
        audioIntervals: [
          { seq: 1, micDeviceId: 'MIC-03', sourceClass: 'LOCAL_DEVICE' },
          { seq: 2, micDeviceId: 'MIC-02', sourceClass: 'FAKE' },
        ],
      });
      const lines = verifyReportLines(result);
      expect(lines[0]).toBe(DEVELOPMENT_LINE);
      expect(lines.slice(1, 5)).toEqual([...result.sources.lines, 'Integrity: PASS']);
      expect(lines.indexOf('Integrity: PASS')).toBeLessThan(lines.findIndex((line) => line.startsWith('V-01 ')));
      expect(lines).toContain('V-15 Source class: PASS');
    }
  });

  it('the answer of operation 41 says it: sources.development true beside ok true, and it parses with the registry schema', async () => {
    const built = await developmentPackage();
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf(built.item.evidenceId, 7, await atCore(built)));
    expect(body).toMatchObject({ ok: true, manifestOk: true, signatureOk: true, transcriptOk: true, overall: 'PASS', interrupted: false, failedFragmentCount: 0, fragments: [] });
    expect(body.sources).toEqual({
      ok: true,
      code: 'DEVELOPMENT',
      development: true,
      report: DEVELOPMENT_LINE,
      tracks: [
        { trackId: 'VIDEO-01', deviceId: 'CAM-03', sourceClass: 'LOCAL_DEVICE' },
        { trackId: 'VIDEO-02', deviceId: 'CAM-02', sourceClass: 'FAKE' },
      ],
      audioIntervals: [
        { seq: 1, micDeviceId: 'MIC-03', sourceClass: 'LOCAL_DEVICE' },
        { seq: 2, micDeviceId: 'MIC-02', sourceClass: 'FAKE' },
      ],
    });
    expect(body.checks?.map((check) => `${check.id} ${check.status}`)).toEqual(ALL.map((id) => `${id} PASS`));
    expect(body.transcriptState).toMatchObject({ code: 'READY', documentSealed: true });
  });

  it('CONTROL - the verdict does not change with the mark: all-FAKE, development and all-PRODUCTION packages pass the same 15 checks, and only a development one has the development line', async () => {
    const fake = await atCore(await buildPackage({ revisions: 1 }));
    const development = await atCore(await developmentPackage());
    const production = await atCore(await productionPackage());
    const statuses = (result: PackageVerifyResult): string[] => result.checks.map((check) => `${check.id} ${check.status}`);
    expect(statuses(fake)).toEqual(statuses(development));
    expect(statuses(production)).toEqual(statuses(development));
    expect([fake.ok, development.ok, production.ok]).toEqual([true, true, true]);
    expect([fake.sources.code, development.sources.code, production.sources.code]).toEqual(['DEVELOPMENT', 'DEVELOPMENT', 'DECLARED_PRODUCTION']);
    // §H.5: an all-PRODUCTION manifest is a DECLARATION of the Core that sealed it; the line says so and is first too.
    expect(production.sources).toMatchObject({ ok: true, development: false, report: PRODUCTION_LINE, lines: [] });
    expect(production.sources.tracks.map((track) => track.sourceClass)).toEqual(['PRODUCTION', 'PRODUCTION']);
    const lines = verifyReportLines(production);
    expect(lines[0]).toBe(PRODUCTION_LINE);
    expect(lines).not.toContain(DEVELOPMENT_LINE);
    expect(PRODUCTION_LINE).toContain('declared');
    expect(verifyReportLines(fake)[0]).toBe(DEVELOPMENT_LINE);
  });

  it('the mark never hides a failure: a development package with one altered fragment fails as any other, and still reports its sources', async () => {
    const built = await developmentPackage();
    const target = built.fragment('VIDEO-02', 3);
    flipByte(built.path('fragments/VIDEO-02.mp4'), target.byteOffset + 5);
    const result = await atCore(built);
    expect(result).toMatchObject({ ok: false, overall: 'TAMPERED' });
    expect(failing(result)).toEqual(['V-04', 'V-06', 'V-08']);
    expect(statusOf(result, 'V-15')).toBe('PASS');
    // The manifest is still the signed one: what it says of the sources stands.
    expect(result.sources).toMatchObject({ ok: true, code: 'DEVELOPMENT', development: true });
    const lines = verifyReportLines(result);
    expect(lines[0]).toBe(DEVELOPMENT_LINE);
    expect(lines).toContain('Integrity: FAIL (TAMPERED)');
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf(built.item.evidenceId, 7, result));
    expect(body.fragments).toEqual([{ trackId: 'VIDEO-02', seq: 3, ok: false, reason: 'TAMPERED', storedOk: false, plainOk: null }]);
    expect(body.checks?.find((check) => check.id === 'V-08')?.findings).toEqual([{ code: 'FRAGMENT_TAMPERED', failureClass: 'TAMPERED', trackId: 'VIDEO-02', seq: 3 }]);
  });
});

describe('M7-DEVSRC-TAMPER-1: changing or removing a class or the flag fails, at the layer that catches it', () => {
  it('CONTROL - the untouched package of M7-DEVSRC-SEAL-1 passes the same two runs', async () => {
    const built = await developmentPackage();
    expect((await atCore(built)).ok).toBe(true);
    expect((await alone(built)).ok).toBe(true);
  });

  it('a raw edit of one class (LOCAL_DEVICE -> PRODUCTION): the manifest hash fails (V-03), and the edited class is not repeated', async () => {
    const built = await developmentPackage();
    editManifest(built, (manifest) => (manifest.tracks[0].sourceClass = 'PRODUCTION'));
    for (const result of [await atCore(built), await alone(built)]) {
      expect(failing(result)).toEqual(['V-03']);
      expect(result.checks.find((check) => check.id === 'V-03')?.findings.map((finding) => finding.code)).toContain('MANIFEST_HASH_MISMATCH');
      expect(result.overall).toBe('TAMPERED');
      // The edit left a well-formed, consistent mark: V-15 has nothing to find, and says nothing for it either.
      expect(v15(result)).toMatchObject({ status: 'PASS' });
      expectNotTrustworthy(result);
    }
  });

  it('a raw edit of every class to PRODUCTION with the flag turned off: V-03 fails; "production" is never stated', async () => {
    const built = await developmentPackage();
    editManifest(built, (manifest) => {
      for (const track of manifest.tracks) track.sourceClass = 'PRODUCTION';
      for (const interval of manifest.audio.sourceIntervals) interval.sourceClass = 'PRODUCTION';
      manifest.developmentSources = false;
    });
    const result = await alone(built);
    expect(failing(result)).toEqual(['V-03']);
    expectNotTrustworthy(result);
  });

  it('a class REMOVED raw: V-01 (field missing), V-03 and V-15 MISSING - absence is never read as PRODUCTION', async () => {
    const built = await developmentPackage();
    editManifest(built, (manifest) => delete manifest.tracks[1].sourceClass);
    const result = await atCore(built);
    expect(failing(result)).toEqual(['V-01', 'V-03', 'V-15']);
    expect(v15(result)).toEqual({ status: 'FAIL', failureClass: 'MISSING', skipped: null, found: ['SOURCE_CLASS_MISSING MISSING tracks.1.sourceClass'] });
    expectNotTrustworthy(result);
  });

  it('the edit hidden from the hash (manifestSha256 and signature.sig recomputed), no valid signature: V-09 fails; at the Core V-03 too', async () => {
    const built = await developmentPackage();
    editManifest(built, (manifest) => (manifest.audio.sourceIntervals[0].sourceClass = 'PRODUCTION'), { recomputeHash: true });
    const held = await alone(built);
    expect(failing(held)).toEqual(['V-09']);
    expect(held.checks.find((check) => check.id === 'V-09')?.findings.map((finding) => finding.code)).toEqual(['SIGNATURE_INVALID']);
    expect(statusOf(held, 'V-03')).toBe('PASS');
    expectNotTrustworthy(held);
    // The Core also knows the digest it signed.
    const core = await atCore(built);
    expect(failing(core)).toEqual(['V-03', 'V-09']);
    expectNotTrustworthy(core);
  });

  it('field 126 DELETED and re-hashed: V-15 MISSING (and V-01, V-09)', async () => {
    const built = await developmentPackage();
    editManifest(built, (manifest) => delete manifest.developmentSources, { recomputeHash: true });
    const result = await alone(built);
    expect(failing(result)).toEqual(['V-01', 'V-15']);
    expect(v15(result)).toEqual({ status: 'FAIL', failureClass: 'MISSING', skipped: null, found: ['DEVELOPMENT_FLAG_MISSING MISSING developmentSources'] });
    // V-09 cannot run without a manifest that parsed: SKIPPED, which is not a pass.
    expect(statusOf(result, 'V-09')).toBe('SKIPPED');
    expectNotTrustworthy(result);
  });

  it('a class outside the three values, and a flag that is no boolean: V-15 MISSING, each named', async () => {
    const built = await developmentPackage();
    editManifest(
      built,
      (manifest) => {
        manifest.tracks[0].sourceClass = 'TRUSTED';
        manifest.audio.sourceIntervals[1].sourceClass = null;
        manifest.developmentSources = 'no';
      },
      { recomputeHash: true },
    );
    const result = await alone(built);
    expect(v15(result)).toEqual({
      status: 'FAIL',
      failureClass: 'MISSING',
      skipped: null,
      found: ['SOURCE_CLASS_INVALID MISSING tracks.0.sourceClass', 'SOURCE_CLASS_INVALID MISSING audio.sourceIntervals.1.sourceClass', 'DEVELOPMENT_FLAG_INVALID MISSING developmentSources'],
    });
    expectNotTrustworthy(result);
  });

  it('a CONSISTENT FORGERY OF THE FLAG ONLY, re-signed with another key and its certificate: the hash holds against the folder itself - V-15 CORRUPT names the forgery', async () => {
    const built = await developmentPackage();
    const forger = throwAwaySigner('KEY-FORGER');
    editManifest(built, (manifest) => (manifest.developmentSources = false), { resignWith: forger, replaceCertificate: true });
    const held = await alone(built);
    // The forger re-hashed: the manifest hash holds. The strict schema refuses the manifest (V-01),
    // so the signature and the certificate are not even asked (SKIPPED, not a pass); V-15 names why.
    expect(statusOf(held, 'V-03')).toBe('PASS');
    expect([statusOf(held, 'V-09'), statusOf(held, 'V-13')]).toEqual(['SKIPPED', 'SKIPPED']);
    expect(failing(held)).toEqual(['V-01', 'V-15']);
    expect(held.checks.find((check) => check.id === 'V-01')?.findings.map((finding) => `${finding.code} ${finding.member ?? ''}`)).toEqual(['MANIFEST_FIELD_INVALID developmentSources']);
    expect(v15(held)).toEqual({ status: 'FAIL', failureClass: 'CORRUPT', skipped: null, found: ['DEVELOPMENT_FLAG_INCONSISTENT CORRUPT developmentSources'] });
    expect(held.overall).toBe('CORRUPT');
    expectNotTrustworthy(held);
  });

  it('one microphone with two classes, re-signed: V-15 CORRUPT', async () => {
    const built = await developmentPackage();
    const forger = throwAwaySigner('KEY-FORGER');
    editManifest(
      built,
      (manifest) => {
        manifest.audio.sourceIntervals[1].micDeviceId = manifest.audio.sourceIntervals[0].micDeviceId;
      },
      { resignWith: forger, replaceCertificate: true },
    );
    const result = await alone(built);
    expect(v15(result)).toEqual({ status: 'FAIL', failureClass: 'CORRUPT', skipped: null, found: ['MIC_SOURCE_CLASS_INCONSISTENT CORRUPT audio.sourceIntervals.1.sourceClass'] });
    expectNotTrustworthy(result);
  });

  it('THE LIMIT (§H.5), stated by a test: a whole re-signed all-PRODUCTION forgery verifies against its own folder as DECLARED production; the anchors of the Core refuse it', async () => {
    const built = await developmentPackage();
    const forger = throwAwaySigner('KEY-FORGER');
    editManifest(
      built,
      (manifest) => {
        for (const track of manifest.tracks) track.sourceClass = 'PRODUCTION';
        for (const interval of manifest.audio.sourceIntervals) interval.sourceClass = 'PRODUCTION';
        manifest.developmentSources = false;
      },
      { resignWith: forger, replaceCertificate: true },
    );
    const held = await alone(built);
    expect(held.sources).toMatchObject({ ok: true, code: 'DECLARED_PRODUCTION', development: false, report: PRODUCTION_LINE });
    // The Core knows the digest it signed and its own certificate.
    const core = await atCore(built);
    // V-11 too: the revision's certificate is not one the Core trusts either.
    expect(failing(core)).toEqual(['V-03', 'V-11', 'V-13']);
    expectNotTrustworthy(core);
  });

  it('no manifest at all, and a manifest that is no JSON: V-15 is SKIPPED (never PASS) and the sources are UNKNOWN', async () => {
    const built = await developmentPackage();
    writeFileSync(built.path(PackageFile.MANIFEST), '{ not json');
    const broken = await alone(built);
    expect(v15(broken)).toMatchObject({ status: 'SKIPPED', skipped: 'BLOCKED' });
    expect(broken.sources).toMatchObject({ ok: false, code: 'UNKNOWN', development: null, report: SOURCES_STATE_REPORT.UNKNOWN, tracks: [] });
    rmSync(built.path(PackageFile.MANIFEST));
    const absent = await alone(built);
    expect(v15(absent)).toMatchObject({ status: 'SKIPPED', skipped: 'BLOCKED' });
    expect(absent.sources.code).toBe('UNKNOWN');
    expect(verifyReportLines(absent)[0]).toBe('Sources: unknown — the manifest cannot be read');
  });
});

describe('M7-SEC-SRC-2 (verify side): the class is the Core\'s, from the adapter kind', () => {
  it('a class and a flag smuggled into the builder\'s input are overwritten by the classes of the source rows', () => {
    const rows = developmentRows();
    const input = exampleManifestInput();
    devicesOf(rows)(input);
    const smuggled = input as unknown as { developmentSources: boolean; tracks: { sourceClass: string }[]; audio: { sourceIntervals: { sourceClass: string }[] } };
    smuggled.developmentSources = false;
    for (const track of smuggled.tracks) track.sourceClass = 'PRODUCTION';
    for (const interval of smuggled.audio.sourceIntervals) interval.sourceClass = 'PRODUCTION';
    const manifest = buildUnsignedManifest(input, rows);
    expect(manifest.tracks.map((track) => track.sourceClass)).toEqual(['LOCAL_DEVICE', 'FAKE']);
    expect(manifest.audio.sourceIntervals.map((interval) => interval.sourceClass)).toEqual(['LOCAL_DEVICE', 'FAKE']);
    expect(manifest.developmentSources).toBe(true);
    // Compile-time: the input type has no such member.
    // @ts-expect-error the builder's input takes no source class
    const refusedTrack: ManifestV2Input['tracks'][number]['sourceClass'] = 'PRODUCTION';
    // @ts-expect-error the builder's input takes no development flag
    const refusedFlag: ManifestV2Input['developmentSources'] = false;
    void [refusedTrack, refusedFlag];
  });

  it('`scope: MANIFEST` reads the manifest and its seal only: five checks run, the rest is OUT_OF_SCOPE and the run is never ok', async () => {
    const built = await developmentPackage();
    // The camera files are not there: a manifest-scope run does not notice, a package run does.
    rmSync(built.path('fragments/VIDEO-01.mp4'));
    const result = await verifyPackageV2(corePorts(built.dir, null), { scope: 'MANIFEST', expected: { sessionId: SESSION_ID, manifestSha256: built.item.manifestSha256 } });
    expect(result.checks.filter((check) => check.status === 'PASS').map((check) => check.id)).toEqual(['V-01', 'V-03', 'V-09', 'V-13', 'V-15']);
    expect(result.checks.filter((check) => check.skipped === 'OUT_OF_SCOPE').map((check) => check.id)).toEqual(['V-02', 'V-04', 'V-05', 'V-06', 'V-07', 'V-08', 'V-10', 'V-11', 'V-12', 'V-14']);
    expect(result.ok).toBe(false);
    expect(result.sources).toMatchObject({ code: 'DEVELOPMENT', development: true });
    expect((await alone(built)).checks.find((check) => check.id === 'V-04')?.status).toBe('FAIL');
  });

  it('the signed mark reader of the reset guard: development only for a verified development manifest of THAT item', async () => {
    const built = await developmentPackage();
    const anchors = { sessionId: built.item.sessionId, evidenceId: built.item.evidenceId, manifestSha256: built.item.manifestSha256 };
    expect(await readSealedSourceMark(built.dir, anchors)).toEqual({ signed: true, development: true });
    // Another session, another item, another digest: not the package of this row.
    expect(await readSealedSourceMark(built.dir, { ...anchors, sessionId: 'SES-20261009-0002' })).toEqual({ signed: false, development: false });
    expect(await readSealedSourceMark(built.dir, { ...anchors, evidenceId: 'EV-20261009-0002' })).toEqual({ signed: false, development: false });
    expect(await readSealedSourceMark(built.dir, { ...anchors, manifestSha256: 'ab'.repeat(32) })).toEqual({ signed: false, development: false });
    expect(await readSealedSourceMark(built.dir, { ...anchors, trustedCertificateSha256: ['cd'.repeat(32)] })).toEqual({ signed: false, development: false });
    // No folder, and a path that is a file.
    expect(await readSealedSourceMark(`${built.dir}-absent`, anchors)).toEqual({ signed: false, development: false });
    expect(await readSealedSourceMark(built.path(PackageFile.MANIFEST), anchors)).toEqual({ signed: false, development: false });

    // A signed all-PRODUCTION manifest is signed, and not development.
    const production = await productionPackage();
    expect(await readSealedSourceMark(production.dir, { sessionId: production.item.sessionId, evidenceId: production.item.evidenceId, manifestSha256: production.item.manifestSha256 })).toEqual({ signed: true, development: false });

    // Edited after the seal (raw), and re-hashed without a signature: not signed.
    editManifest(built, (manifest) => (manifest.notice = `${String(manifest.notice)} `));
    expect(await readSealedSourceMark(built.dir, anchors)).toEqual({ signed: false, development: false });
    const rehashed = await developmentPackage();
    editManifest(rehashed, (manifest) => (manifest.notice = `${String(manifest.notice)} `), { recomputeHash: true });
    expect(await readSealedSourceMark(rehashed.dir, { sessionId: rehashed.item.sessionId })).toEqual({ signed: false, development: false });
  });
});

describe('the answer of operation 41 for the transcript states (row 119\'s request)', () => {
  it('DISABLED: no transcriptOk, the state says why; a sealed transcript: transcriptOk true', async () => {
    const disabled = await atCore(await developmentPackage({ transcript: 'DISABLED', revisions: 0 }));
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf(EVIDENCE_ID, 1, disabled));
    expect(body.ok).toBe(true);
    expect('transcriptOk' in body).toBe(false);
    expect(body.transcriptState).toMatchObject({ code: 'DISABLED_BY_CONFIGURATION', documentSealed: false });
    const sealed = EvidenceVerifyResultSchema.parse(contractBodyOf(EVIDENCE_ID, 1, await atCore(await developmentPackage())));
    expect(sealed.transcriptOk).toBe(true);
  });

  it('UNAVAILABLE at the seal: no transcriptOk either - nothing of a transcript was checked, so nothing is answered as a pass', async () => {
    const built = await developmentPackage();
    const report = await atCore(built);
    // The report of a no-document PARTIAL package (the shape row 119 seals; its packages are built in the sealing tests).
    const unavailable: PackageVerifyResult = {
      ...report,
      transcript: { state: 'UNAVAILABLE', revisions: null },
      transcriptState: { code: 'UNAVAILABLE_AT_SEAL', report: 'Transcript unavailable at seal', sealedState: 'PARTIAL', reason: 'TRANSCRIPT_UNAVAILABLE_AT_SEAL', documentSealed: false, failedChunks: null, backendUnreachable: false },
    };
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf(EVIDENCE_ID, 1, unavailable));
    expect('transcriptOk' in body).toBe(false);
    expect(body.transcriptState?.code).toBe('UNAVAILABLE_AT_SEAL');
    // CONTROL: the same report with a verified transcript answers the member.
    expect('transcriptOk' in contractBodyOf(EVIDENCE_ID, 1, report)).toBe(true);
  });

  it('a list longer than the contract carries is cut, and its true length is answered beside it', async () => {
    const built = await developmentPackage({ fragments: 140, fragmentBytes: 64 });
    for (const trackId of ['VIDEO-01', 'VIDEO-02'] as const) {
      for (let seq = 1; seq <= 140; seq += 1) flipByte(built.path(`fragments/${trackId}.mp4`), built.fragment(trackId, seq).byteOffset);
    }
    const report = await atCore(built);
    expect(report.fragments).toHaveLength(280);
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf(built.item.evidenceId, 1, report));
    expect(body.fragments).toHaveLength(256);
    expect(body.failedFragmentCount).toBe(280);
    const v04 = body.checks?.find((check) => check.id === 'V-04');
    expect(v04?.findings).toHaveLength(64);
    expect(v04?.findingCount).toBeGreaterThanOrEqual(280);
    expect(body.checks?.find((check) => check.id === 'V-15')).toMatchObject({ status: 'PASS', findings: [] });
    expect('findingCount' in (body.checks?.find((check) => check.id === 'V-15') ?? {})).toBe(false);
  });
});
