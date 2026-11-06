// Integration pass D10, item 6 (ruling D160; request of pass D9, file_requests.md 17:26:45Z): the
// model of a sealed transcript in the verify report, and V-10 under the provenance rule.
//
//   cpu-local     the Core read the model file: name, declared version, quantisation and file
//                 SHA-256 are all stated - a null in any of them is a FAILURE
//   omlx-server   a server made the transcript: the name is the server's word; version,
//                 quantisation and file hash are null - permitted ONLY then - and the report says
//                 that the Core verified nothing of the model
//
// Each acceptance has its refusals beside it. The packages are built on real bytes, hashes and
// signatures by this folder's builder; the manifest of a forger is written raw and re-signed.
import { afterAll, describe, expect, it } from 'vitest';
import { verifyPackageV2, verifyReportLines, type PackageVerifyResult, type VerifyCheckId } from '@dems/shared/evidence-verify';
import { EvidenceVerifyResultSchema } from '@dems/shared/api';
import { contractBodyOf, corePorts } from '../index';
import { buildPackage, editManifest, removeScratch, throwAwaySigner, transcriptDocumentText, type BuildOptions, type BuiltPackage } from './support';

afterAll(removeScratch);

const SERVER_LINE = (name: string): string => `Transcript model: ${name} (reported by the STT server; version, quantisation and file hash are not available to the Core and were not verified)`;
const SERVER_MODEL = { backend: 'omlx-server', model: { name: 'whisper-large-v3-turbo', version: null, quantisation: null, modelSha256: null } } as const satisfies NonNullable<BuildOptions['transcriptModel']>;
const HASH = 'ab'.repeat(32);

const verify = (built: BuiltPackage): Promise<PackageVerifyResult> => verifyPackageV2(corePorts(built.dir, built.opener, 256), { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [built.signer.certificate.sha256] } });
const failing = (result: PackageVerifyResult): VerifyCheckId[] => result.checks.filter((check) => check.status === 'FAIL').map((check) => check.id);
const findings = (result: PackageVerifyResult, id: VerifyCheckId) => result.checks.find((check) => check.id === id)?.findings ?? [];
const modelLines = (result: PackageVerifyResult): string[] => verifyReportLines(result).filter((line) => line.startsWith('Transcript model'));

describe('a SERVER backend (omlx-server): the nulls are accepted, and the report says the model was not verified', () => {
  it('PASS on every check; the report prints the server sentence with the name, right after the transcript state; operation 41 carries the member', async () => {
    const built = await buildPackage({ transcriptModel: SERVER_MODEL });
    const result = await verify(built);
    expect(failing(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.transcriptModel).toEqual({ name: 'whisper-large-v3-turbo', version: null, quantisation: null, modelSha256: null, reportedByServer: true, report: SERVER_LINE('whisper-large-v3-turbo') });
    const lines = verifyReportLines(result);
    expect(modelLines(result)).toEqual([SERVER_LINE('whisper-large-v3-turbo')]);
    expect(lines[lines.indexOf(result.transcriptState.report) + 1]).toBe(SERVER_LINE('whisper-large-v3-turbo'));
    // The line claims no version, no quantisation and no hash.
    expect(modelLines(result)[0]).not.toMatch(/[0-9a-f]{64}|version [^,]*\(declared/);
    const body = EvidenceVerifyResultSchema.parse(contractBodyOf(built.item.evidenceId, 1, result));
    expect(body.transcriptModel).toEqual(result.transcriptModel);
  });

  it('REFUSED: a server manifest that states a file hash, a version or a quantisation - re-hashed and re-signed by a forger with a valid signature - fails V-01', async () => {
    for (const [member, value] of [['modelSha256', HASH], ['version', '3'], ['quantisation', 'q5_0']] as const) {
      const built = await buildPackage({ transcriptModel: SERVER_MODEL });
      const forger = throwAwaySigner();
      editManifest(built, (manifest) => (manifest.transcript.model[member] = value), { resignWith: forger, replaceCertificate: true });
      const result = await verifyPackageV2(corePorts(built.dir, built.opener, 256), { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [forger.certificate.sha256] } });
      expect(failing(result), member).toContain('V-01');
      expect(result.ok, member).toBe(false);
      // Nothing an unreadable manifest says of a model is repeated.
      expect(result.transcriptModel, member).toBeNull();
      expect(modelLines(result), member).toEqual([]);
    }
  });

  it('REFUSED: the sealed DOCUMENT states a file hash while the manifest says null - V-10 fails and names the member', async () => {
    const built = await buildPackage({ transcriptModel: SERVER_MODEL, transcriptDocument: transcriptDocumentText('omlx-server', { ...SERVER_MODEL.model, modelSha256: HASH }) });
    const result = await verify(built);
    expect(failing(result)).toEqual(['V-10']);
    expect(findings(result, 'V-10')).toEqual([{ code: 'TRANSCRIPT_MODEL_MISMATCH', failureClass: 'TAMPERED', file: 'transcript/transcript.json', member: 'model.sha256' }]);
    expect(result.transcript.state).toBe('FAILED');
  });

  it('REFUSED: the document names another backend or another model than the manifest', async () => {
    const otherBackend = await verify(await buildPackage({ transcriptModel: SERVER_MODEL, transcriptDocument: transcriptDocumentText('cpu-local', SERVER_MODEL.model) }));
    // The document says cpu-local with three nulls: the backend disagrees AND its own rule is broken.
    expect(findings(otherBackend, 'V-10').map((finding) => finding.member).sort()).toEqual(['backend', 'model.quantisation', 'model.sha256', 'model.version']);
    const otherName = await verify(await buildPackage({ transcriptModel: SERVER_MODEL, transcriptDocument: transcriptDocumentText('omlx-server', { ...SERVER_MODEL.model, name: 'another-model' }) }));
    expect(findings(otherName, 'V-10').map((finding) => finding.member)).toEqual(['model.name']);
  });

  it('REFUSED: a document without a header cannot be held against the manifest', async () => {
    const result = await verify(await buildPackage({ transcriptModel: SERVER_MODEL, transcriptDocument: '{"documentVersion":"dems.transcript/1","segments":[]}\n' }));
    expect(failing(result)).toEqual(['V-10']);
    expect(findings(result, 'V-10')).toMatchObject([{ code: 'TRANSCRIPT_MODEL_MISMATCH', member: 'header' }]);
  });
});

describe('cpu-local: the Core read the model file - nothing is loosened', () => {
  it('PASS; the report prints the name, the declared version, the quantisation and the file SHA-256', async () => {
    const built = await buildPackage();
    const result = await verify(built);
    expect(failing(result)).toEqual([]);
    const model = built.manifest.transcript.model;
    expect(result.transcriptModel).toMatchObject({ name: model.name, version: model.version, quantisation: model.quantisation, modelSha256: model.modelSha256, reportedByServer: false });
    expect(modelLines(result)).toEqual([`Transcript model: ${model.name}, version ${model.version} (declared by the installation), quantisation ${model.quantisation}, file SHA-256 ${model.modelSha256}`]);
    // CONTROL: this package is not told as a server's.
    expect(modelLines(result)[0]).not.toContain('reported by the STT server');
  });

  it('REFUSED: a cpu-local manifest with a null version, quantisation or file hash - valid forger signature included - fails V-01: the nulls are the server\'s alone', async () => {
    for (const member of ['version', 'quantisation', 'modelSha256'] as const) {
      const built = await buildPackage();
      const forger = throwAwaySigner();
      editManifest(built, (manifest) => (manifest.transcript.model[member] = null), { resignWith: forger, replaceCertificate: true });
      const result = await verifyPackageV2(corePorts(built.dir, built.opener, 256), { plaintext: 'REQUIRED', expected: { ...built.item, trustedCertificateSha256: [forger.certificate.sha256] } });
      expect(failing(result), member).toContain('V-01');
      expect(result.ok, member).toBe(false);
      expect(modelLines(result), member).toEqual([]);
    }
  });

  it('REFUSED: a cpu-local DOCUMENT with a null file hash under an untouched manifest fails V-10 (the mismatch, and the document\'s own rule: one finding for the member)', async () => {
    const complete = await buildPackage();
    const model = complete.manifest.transcript.model;
    const built = await buildPackage({ transcriptDocument: transcriptDocumentText('cpu-local', { ...model, modelSha256: null }) });
    const result = await verify(built);
    expect(failing(result)).toEqual(['V-10']);
    expect(findings(result, 'V-10')).toEqual([{ code: 'TRANSCRIPT_MODEL_MISMATCH', failureClass: 'TAMPERED', file: 'transcript/transcript.json', member: 'model.sha256' }]);
  });
});

describe('no document, no model line', () => {
  it('a package sealed with STT disabled prints the state and no model', async () => {
    const result = await verify(await buildPackage({ transcript: 'DISABLED' }));
    expect(failing(result)).toEqual([]);
    expect(result.transcriptModel).toBeNull();
    expect(modelLines(result)).toEqual([]);
  });
});
